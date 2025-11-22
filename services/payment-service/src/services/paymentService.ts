import stripe from '../config/stripe';
import { PaymentModel } from '../models/paymentModel';
import orderServiceClient from '../clients/orderServiceClient';
import redisClient from '../config/redis';

export const PaymentService = {
  // Create payment intent
  async createPaymentIntent(orderId: number) {
    // Check if payment already exists
    const existingPayment = await PaymentModel.findByOrderId(orderId);

    if (existingPayment) {
      if (existingPayment.status === 'succeeded') {
        throw new Error('Order already paid');
      }

      // Return existing payment intent
      return {
        paymentIntentId: existingPayment.stripe_payment_intent_id,
        clientSecret: existingPayment.stripe_client_secret,
        amount: existingPayment.amount,
        currency: existingPayment.currency,
        status: existingPayment.status,
      };
    }

    // Get order details
    const order = await orderServiceClient.getOrder(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status === 'cancelled') {
      throw new Error('Cannot pay for cancelled order');
    }

    // Create Stripe payment intent
    console.log(`[Payment] Creating payment intent for order ${orderId}`);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total_amount * 100), // Convert to cents
      currency: 'INR',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        orderId: orderId.toString(),
        userId: order.user_id.toString(),
      },
      description: `Order #${orderId}`,
    });

    // Store payment in database
    const payment = await PaymentModel.create({
      order_id: orderId,
      stripe_payment_intent_id: paymentIntent.id,
      amount: order.total_amount,
      currency: 'INR',
      stripe_client_secret: paymentIntent.client_secret!,
    });

    console.log(`[Payment] Payment intent created: ${paymentIntent.id}`);

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
    };
  },

  // Get payment status
  async getPaymentStatus(orderId: number) {
    const payment = await PaymentModel.findByOrderId(orderId);

    if (!payment) {
      throw new Error('Payment not found');
    }

    // Optionally sync with Stripe
    if (payment.stripe_payment_intent_id && payment.status === 'pending') {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          payment.stripe_payment_intent_id
        );

        if (paymentIntent.status !== (payment.status as string)) {
          await PaymentModel.updateStatus(payment.id, paymentIntent.status as string);
          payment.status = paymentIntent.status as string;
        }
      } catch (error) {
        console.error('Error syncing payment status with Stripe:', error);
      }
    }

    return payment;
  },

  // Process webhook (idempotent)
  async processWebhook(event: any) {
    const eventId = event.id;
    const eventType = event.type;

    console.log(`[Webhook] Received: ${eventType} (${eventId})`);

    // Check idempotency - have we processed this event?
    const cacheKey = `webhook:processed:${eventId}`;
    const cachedResult = await redisClient.get(cacheKey);

    if (cachedResult) {
      console.log(`[Webhook] Already processed: ${eventId}`);
      return { processed: true, cached: true };
    }

    const alreadyProcessed = await PaymentModel.hasEventBeenProcessed(eventId);

    if (alreadyProcessed) {
      console.log(`[Webhook] Already processed in DB: ${eventId}`);
      await redisClient.setEx(cacheKey, 86400, 'processed'); // Cache for 24h
      return { processed: true, cached: false };
    }

    // Process based on event type
    try {
      switch (eventType) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event);
          break;

        default:
          console.log(`[Webhook] Unhandled event type: ${eventType}`);
      }

      // Mark as processed
      await redisClient.setEx(cacheKey, 86400, 'processed');
      console.log(`[Webhook] Processed successfully: ${eventId}`);

      return { processed: true, cached: false };
    } catch (error) {
      console.error(`[Webhook] Processing error for ${eventId}:`, error);
      throw error;
    }
  },

  // Handle successful payment
  async handlePaymentSucceeded(event: any) {
    const paymentIntent = event.data.object;
    const orderId = parseInt(paymentIntent.metadata.orderId);

    console.log(`[Webhook] Payment succeeded for order ${orderId}`);

    // Find payment
    const payment = await PaymentModel.findByPaymentIntentId(paymentIntent.id);

    if (!payment) {
      console.error(`Payment not found for intent: ${paymentIntent.id}`);
      return;
    }

    // Update payment status
    await PaymentModel.updateStatus(payment.id, 'succeeded', {
      payment_method: paymentIntent.payment_method_types?.[0],
      stripe_charge_id: paymentIntent.latest_charge,
      customer_email: paymentIntent.receipt_email,
    });

    // Record event
    await PaymentModel.recordEvent(
      payment.id,
      event.id,
      event.type,
      paymentIntent
    );

    // Update order status to 'paid'
    try {
      await orderServiceClient.updateOrderStatus(orderId, 'paid');
      console.log(`[Webhook] Order ${orderId} marked as paid`);
    } catch (error) {
      console.error(`Failed to update order ${orderId}:`, error);
      // Payment succeeded but order update failed - needs manual intervention
      // In production, queue for retry or alert admin
    }
  },

  // Handle failed payment
  async handlePaymentFailed(event: any) {
    const paymentIntent = event.data.object;
    const orderId = parseInt(paymentIntent.metadata.orderId);

    console.log(`[Webhook] Payment failed for order ${orderId}`);

    const payment = await PaymentModel.findByPaymentIntentId(paymentIntent.id);

    if (!payment) {
      console.error(`Payment not found for intent: ${paymentIntent.id}`);
      return;
    }

    // Update payment status
    await PaymentModel.updateStatus(payment.id, 'failed', {
      error_code: paymentIntent.last_payment_error?.code,
      error_message: paymentIntent.last_payment_error?.message,
    });

    // Record event
    await PaymentModel.recordEvent(
      payment.id,
      event.id,
      event.type,
      paymentIntent
    );

    console.log(`[Webhook] Payment ${payment.id} marked as failed`);
  },

  // Handle canceled payment
  async handlePaymentCanceled(event: any) {
    const paymentIntent = event.data.object;

    console.log(`[Webhook] Payment canceled: ${paymentIntent.id}`);

    const payment = await PaymentModel.findByPaymentIntentId(paymentIntent.id);

    if (!payment) {
      return;
    }

    await PaymentModel.updateStatus(payment.id, 'cancelled');

    await PaymentModel.recordEvent(
      payment.id,
      event.id,
      event.type,
      paymentIntent
    );
  },

  // Handle refund
  async handleChargeRefunded(event: any) {
    const charge = event.data.object;
    const paymentIntentId = charge.payment_intent;

    console.log(`[Webhook] Refund processed for charge: ${charge.id}`);

    const payment = await PaymentModel.findByPaymentIntentId(paymentIntentId);

    if (!payment) {
      return;
    }

    const refundAmount = charge.amount_refunded / 100; // Convert from cents

    await PaymentModel.recordRefund(
      payment.id,
      refundAmount,
      charge.refunds?.data?.[0]?.reason
    );

    await PaymentModel.recordEvent(payment.id, event.id, event.type, charge);

    // Update order status
    try {
      await orderServiceClient.updateOrderStatus(payment.order_id, 'refunded');
    } catch (error) {
      console.error(`Failed to update order ${payment.order_id}:`, error);
    }
  },

  // Create refund
  async createRefund(orderId: number, reason?: string) {
    const payment = await PaymentModel.findByOrderId(orderId);

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'succeeded') {
      throw new Error('Can only refund successful payments');
    }

    if (!payment.stripe_payment_intent_id) {
      throw new Error('No Stripe payment intent found');
    }

    console.log(`[Refund] Creating refund for payment ${payment.id}`);

    // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      reason: reason as any,
    });

    console.log(`[Refund] Refund created: ${refund.id}`);

    // Webhook will handle the database update
    return refund;
  },
};