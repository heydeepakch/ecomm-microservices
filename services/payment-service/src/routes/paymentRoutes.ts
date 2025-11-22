import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authMiddleware, requireRole } from '../middleware/authMiddleware';

const router = Router();

// Create payment intent (requires authentication)
router.post('/create-intent', authMiddleware, PaymentController.createPaymentIntent);

// Get payment status
router.get('/order/:orderId', authMiddleware, PaymentController.getPaymentStatus);

// Create refund (admin only)
router.post(
  '/refund',
  authMiddleware,
  requireRole('admin'),
  PaymentController.createRefund
);

export default router;