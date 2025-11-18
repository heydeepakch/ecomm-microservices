import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { authMiddleware, requireRole, optionalAuth } from '../middleware/authMiddleware';
import upload from '../middleware/uploadMiddleware';

const router = Router();

// Public routes
router.get('/', optionalAuth, ProductController.getProducts);
router.get('/bulk', ProductController.getBulkProducts); // For inter-service calls
router.get('/:id', optionalAuth, ProductController.getProduct);

// Protected routes (seller/admin)
router.post(
  '/',
  authMiddleware,
  requireRole('seller', 'admin'),
  ProductController.createProduct
);

router.put(
  '/:id',
  authMiddleware,
  requireRole('seller', 'admin'),
  ProductController.updateProduct
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole('seller', 'admin'),
  ProductController.deleteProduct
);

// Image upload
router.post(
  '/:id/upload-image',
  authMiddleware,
  requireRole('seller', 'admin'),
  upload.single('image'),
  ProductController.uploadImage
);

// Stock management (internal endpoints for order service)
router.post('/:id/reserve', ProductController.reserveStock);
router.post('/:id/release', ProductController.releaseStock);

export default router;