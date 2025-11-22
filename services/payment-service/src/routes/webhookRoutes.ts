import { Router, raw } from 'express';
import { PaymentController } from '../controllers/paymentController';

const router = Router();

// Webhook endpoint (needs raw body for signature verification)
router.post(
  '/webhook',
  raw({ type: 'application/json' }),
  PaymentController.handleWebhook
);

export default router;