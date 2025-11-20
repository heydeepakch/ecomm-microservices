import { OrderModel } from '../models/orderModel';
import productServiceClient from '../clients/productServiceClient';
import pool from '../config/database';
import { orderQueue } from '../config/queue';

export const OrderService = {
  // Create order with saga pattern
  async createOrder(
    userId: number,
    items: Array<{ productId: number; quantity: number }>,
    shippingDetails: {
      address: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
      notes?: string;
    }
  ) {
    const client = await pool.connect();

    try {
      // SAGA STEP 1: Validate products
      console.log(`[Order] Validating products for user ${userId}`);
      const productIds = items.map((item) => item.productId);
      const products = await productServiceClient.getProducts(productIds);

      if (products.length !== items.length) {
        throw new Error('Some products not found');
      }

      // SAGA STEP 2: Check stock availability
      console.log('[Order] Checking stock availability');
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
        if (product.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
      }

      // SAGA STEP 3: Calculate totals
      const subtotal = items.reduce((sum, item) => {
        const product = products.find((p) => p.id === item.productId);
        return sum + product!.price * item.quantity;
      }, 0);

      const taxAmount = subtotal * 0.1; // 10% tax
      const shippingCost = 10.0; // Flat rate
      const totalAmount = subtotal + taxAmount + shippingCost;

      // SAGA STEP 4: Create order in database (transaction)
      await client.query('BEGIN');

      console.log('[Order] Creating order in database');
      const order = await OrderModel.create({
        user_id: userId,
        subtotal,
        tax_amount: taxAmount,
        shipping_cost: shippingCost,
        total_amount: totalAmount,
        shipping_address: shippingDetails.address,
        shipping_city: shippingDetails.city,
        shipping_state: shippingDetails.state,
        shipping_zip: shippingDetails.zip,
        shipping_country: shippingDetails.country,
        customer_notes: shippingDetails.notes,
      });

      // Log event
      await OrderModel.logEvent(order.id, 'order_created', { items }, true);

      // SAGA STEP 5: Create order items
      console.log('[Order] Creating order items');
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        await OrderModel.createItem({
          order_id: order.id,
          product_id: item.productId,
          product_name: product!.name,
          product_sku: product!.sku,
          quantity: item.quantity,
          unit_price: product!.price,
          total_price: product!.price * item.quantity,
        });
      }

      await client.query('COMMIT');

      // SAGA STEP 6: Reserve stock (compensating transaction on failure)
      console.log('[Order] Reserving stock in Product Service');
      const reservedProducts: number[] = [];

      try {
        for (const item of items) {
          await productServiceClient.reserveStock(
            item.productId,
            item.quantity,
            order.id
          );
          reservedProducts.push(item.productId);

          // Log success
          await OrderModel.logEvent(
            order.id,
            'stock_reserved',
            { productId: item.productId, quantity: item.quantity },
            true
          );
        }

        // Update order status
        await OrderModel.updateStatus(order.id, 'confirmed');
        await OrderModel.logEvent(order.id, 'order_confirmed', {}, true);

        // SAGA STEP 7: Queue background job for email notification
        console.log('[Order] Queuing confirmation email');
        await orderQueue.add('send-order-confirmation', {
          orderId: order.id,
          userId,
          totalAmount,
        });

        return order;
      } catch (error) {
        // COMPENSATING TRANSACTION: Release reserved stock
        console.error('[Order] Stock reservation failed, rolling back:', error);

        await OrderModel.logEvent(
          order.id,
          'stock_reservation_failed',
          { error: (error as Error).message },
          false,
          (error as Error).message
        );

        // Release any successfully reserved stock
        for (const productId of reservedProducts) {
          const item = items.find((i) => i.productId === productId);
          try {
            await productServiceClient.releaseStock(
              productId,
              item!.quantity,
              order.id
            );
            console.log(`[Order] Released stock for product ${productId}`);
          } catch (releaseError) {
            console.error(
              `[Order] Failed to release stock for product ${productId}:`,
              releaseError
            );
          }
        }

        // Cancel order
        await OrderModel.updateStatus(order.id, 'cancelled');
        await OrderModel.logEvent(order.id, 'order_cancelled', {}, true);

        throw new Error('Failed to reserve stock - order cancelled');
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Get order by ID
  async getOrderById(orderId: number, userId?: number) {
    const order = await OrderModel.findByIdWithItems(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    // Check authorization if userId provided
    if (userId && order.user_id !== userId) {
      throw new Error('Not authorized to view this order');
    }

    return order;
  },

  // Get user orders
  async getUserOrders(userId: number, page: number = 1, limit: number = 20) {
    return OrderModel.findByUserId(userId, { page, limit });
  },

  // Update order status
  async updateOrderStatus(orderId: number, newStatus: string) {
    // Validate status transition
    const validStatuses = [
      'pending',
      'confirmed',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new Error('Invalid order status');
    }

    const order = await OrderModel.updateStatus(orderId, newStatus);

    if (!order) {
      throw new Error('Order not found');
    }

    // Queue notification
    await orderQueue.add('send-status-update', {
      orderId,
      newStatus,
    });

    return order;
  },

  // Cancel order
  async cancelOrder(orderId: number, userId?: number) {
    const order = await OrderModel.findByIdWithItems(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    // Check authorization
    if (userId && order.user_id !== userId) {
      throw new Error('Not authorized to cancel this order');
    }

    // Can only cancel pending or confirmed orders
    if (!['pending', 'confirmed'].includes(order.status)) {
      throw new Error('Cannot cancel order in current status');
    }

    // Release stock
    for (const item of order.items) {
      try {
        await productServiceClient.releaseStock(
          item.product_id,
          item.quantity,
          orderId
        );
      } catch (error) {
        console.error(
          `Failed to release stock for product ${item.product_id}:`,
          error
        );
      }
    }

    // Update status
    await OrderModel.updateStatus(orderId, 'cancelled');
    await OrderModel.logEvent(orderId, 'order_cancelled_by_user', { userId }, true);

    return order;
  },

  // Add tracking information
  async addTracking(orderId: number, trackingNumber: string, carrier: string) {
    const order = await OrderModel.updateTracking(orderId, trackingNumber, carrier);

    if (!order) {
      throw new Error('Order not found');
    }

    // Update status to shipped
    await OrderModel.updateStatus(orderId, 'shipped');

    // Queue notification
    await orderQueue.add('send-tracking-update', {
      orderId,
      trackingNumber,
      carrier,
    });

    return order;
  },

  // Get order history
  async getOrderHistory(orderId: number) {
    return OrderModel.getStatusHistory(orderId);
  },
};