import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Internal service-to-service routes (NO AUTH)
router.get('/internal/:id', UserController.getUserInternal);

// Public routes - All require authentication
router.use(authMiddleware);

// Get user profile (authenticated user's own profile)
router.get('/profile', UserController.getProfile);
router.put('/profile', UserController.updateProfile);

export default router;