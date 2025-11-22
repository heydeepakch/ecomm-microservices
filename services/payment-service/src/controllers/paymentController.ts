import { Request, Response } from 'express';
import { PaymentService } from '../services/paymentService';
import stripe from '../config/stripe';

export const PaymentController = {
  // POST /payments/create-intent
  async createPaymentIntent(req: Request, res: Response) {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' });
      }

      const result = await PaymentService.createPaymentIntent(orderId);
      res.json(result);
    } catch (error: any) {
      console.error('Create payment intent error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // GET /payments/order/:orderId
  async getPaymentStatus(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.orderId);
      const payment = await PaymentService.getPaymentStatus(orderId);
      res.json(payment);
    } catch (error: any) {
      console.error('Get payment status error:', error);
      if (error.message === 'Payment not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  },

  // POST /payments/webhook
  async handleWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).json({ error: 'No signature provided' });
    }

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Process webhook
    try {
      await PaymentService.processWebhook(event);
      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      // Still return 200 to Stripe to avoid retries for unrecoverable errors
      res.json({ received: true, error: error.message });
    }
  },

  // POST /payments/refund
  async createRefund(req: Request, res: Response) {
    try {
      const { orderId, reason } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: 'Order ID is required' });
      }

      const refund = await PaymentService.createRefund(orderId, reason);
      res.json(refund);
    } catch (error: any) {
      console.error('Create refund error:', error);
      res.status(400).json({ error: error.message });
    }
  },
};