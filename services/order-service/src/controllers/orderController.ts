import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';

export const OrderController = {
  // POST /orders
  async createOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { items, shippingAddress, shippingCity, shippingState, shippingZip, shippingCountry, customerNotes } = req.body;

      // Validation
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Items are required' });
      }

      if (!shippingAddress) {
        return res.status(400).json({ error: 'Shipping address is required' });
      }

      // Validate items format
      for (const item of items) {
        if (!item.productId || !item.quantity) {
          return res.status(400).json({ error: 'Invalid item format' });
        }
        if (item.quantity < 1) {
          return res.status(400).json({ error: 'Quantity must be at least 1' });
        }
      }

      const order = await OrderService.createOrder(
        userId,
        items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        {
          address: shippingAddress,
          city: shippingCity,
          state: shippingState,
          zip: shippingZip,
          country: shippingCountry,
          notes: customerNotes,
        }
      );

      res.status(201).json(order);
    } catch (error: any) {
      console.error('Create order error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // GET /orders/:id
  async getOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const userId = (req as any).user.userId;
      const userRole = (req as any).user.role;

      // Admin can see all orders, users can only see their own
      const order = await OrderService.getOrderById(
        orderId,
        userRole === 'admin' ? undefined : userId
      );

      res.json(order);
    } catch (error: any) {
      console.error('Get order error:', error);
      if (error.message === 'Order not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Not authorized')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  },

  // GET /orders
  async getOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await OrderService.getUserOrders(userId, page, limit);

      res.json({
        orders: result.orders,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error: any) {
      console.error('Get orders error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // GET /orders/internal/:id (for service-to-service calls)
  async getOrderInternal(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      
      // No user authentication check - this is for internal services
      const order = await OrderService.getOrderById(orderId);
      
      res.json(order);
    } catch (error: any) {
      console.error('Get order (internal) error:', error);
      if (error.message === 'Order not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  },

  // PUT /orders/:id/status
  async updateOrderStatus(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const order = await OrderService.updateOrderStatus(orderId, status);
      res.json(order);
    } catch (error: any) {
      console.error('Update order status error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async updateOrderStatusInternal(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      // No authentication check - this is for internal services
      const order = await OrderService.updateOrderStatus(orderId, status);
      res.json(order);
    } catch (error: any) {
      console.error('Update order status (internal) error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  async updatePaymentStatusInternal(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const { payment_status } = req.body;
  
      console.log(`[Order] Received payment_status update request for order ${orderId}:`, { payment_status, body: req.body });
  
      if (!payment_status) {
        console.error(`[Order] Missing payment_status in request body`);
        return res.status(400).json({ error: 'Payment status is required' });
      }
  
      console.log(`[Order] Calling OrderService.updatePaymentStatus(${orderId}, '${payment_status}')`);
      const order = await OrderService.updatePaymentStatus(orderId, payment_status);
      
      console.log(`[Order] Payment status updated successfully:`, { 
        orderId: order.id, 
        payment_status: order.payment_status 
      });
      
      res.json(order);
    } catch (error: any) {
      console.error('[Order] Update payment status (internal) error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // POST /orders/:id/cancel
  async cancelOrder(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const userId = (req as any).user.userId;
      const userRole = (req as any).user.role;

      const order = await OrderService.cancelOrder(
        orderId,
        userRole === 'admin' ? undefined : userId
      );

      res.json({ message: 'Order cancelled successfully', order });
    } catch (error: any) {
      console.error('Cancel order error:', error);
      if (error.message.includes('Not authorized')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(400).json({ error: error.message });
    }
  },

  // PUT /orders/:id/tracking
  async addTracking(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const { trackingNumber, carrier } = req.body;

      if (!trackingNumber || !carrier) {
        return res.status(400).json({ error: 'Tracking number and carrier are required' });
      }

      const order = await OrderService.addTracking(orderId, trackingNumber, carrier);
      res.json(order);
    } catch (error: any) {
      console.error('Add tracking error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // GET /orders/:id/history
  async getOrderHistory(req: Request, res: Response) {
    try {
      const orderId = parseInt(req.params.id);
      const history = await OrderService.getOrderHistory(orderId);
      res.json(history);
    } catch (error: any) {
      console.error('Get order history error:', error);
      res.status(500).json({ error: error.message });
    }
  },
};