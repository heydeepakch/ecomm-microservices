import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Internal service-to-service routes (NO AUTH)
// These should only be accessible from within the Docker network
router.get('/internal/:id', OrderController.getOrderInternal);
router.put('/internal/:id/payment-status', OrderController.updatePaymentStatusInternal);
router.put('/internal/:id/status', OrderController.updateOrderStatusInternal);


// Public routes - All require authentication
router.use(authMiddleware);

// Create order
router.post('/', OrderController.createOrder);

// Get user orders
router.get('/', OrderController.getOrders);

// Get single order
router.get('/:id', OrderController.getOrder);

// Cancel order
router.post('/:id/cancel', OrderController.cancelOrder);

// Get order history
router.get('/:id/history', OrderController.getOrderHistory);

// Admin/seller only routes
router.put(
  '/:id/status',
  requireRole('admin', 'seller'),
  OrderController.updateOrderStatus
);

router.put(
  '/:id/tracking',
  requireRole('admin', 'seller'),
  OrderController.addTracking
);

export default router;