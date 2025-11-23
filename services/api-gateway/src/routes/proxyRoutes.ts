import { Router } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { SERVICES } from '../config/services';
import { authMiddleware, optionalAuth, requireRole } from '../middleware/authMiddleware';
import { authLimiter, paymentLimiter, generalLimiter } from '../middleware/rateLimitMiddleware';
import { cacheMiddleware } from '../middleware/cacheMiddleware';
import logger from '../config/logger';

const router = Router();

// Apply general rate limiting to all routes
router.use(generalLimiter);

// User Service routes - Auth
router.use(
  '/auth',
  authLimiter,
  createProxyMiddleware({
    target: SERVICES.USER.url,
    changeOrigin: true,
    pathRewrite: (path) => '/auth' + path, // Restore /auth prefix
    on: {
      proxyReq: fixRequestBody,
      error: (err, req, res) => {
        logger.error({ err }, 'User service proxy error');
        if (res && typeof (res as any).status === 'function') {
          (res as any).status(503).json({ error: 'User service unavailable' });
        }
      },
    },
  })
);

// User Service routes - Users
router.use(
  '/users',
  authMiddleware,
  createProxyMiddleware({
    target: SERVICES.USER.url,
    changeOrigin: true,
    pathRewrite: (path) => '/users' + path, // Restore /users prefix
    on: {
      proxyReq: fixRequestBody,
      error: (err, req, res) => {
        logger.error({ err }, 'User service proxy error');
        if (res && typeof (res as any).status === 'function') {
          (res as any).status(503).json({ error: 'User service unavailable' });
        }
      },
    },
  })
);

// Product Service routes
router.use(
  '/products',
  optionalAuth,
  cacheMiddleware(300),
  createProxyMiddleware({
    target: SERVICES.PRODUCT.url,
    changeOrigin: true,
    pathRewrite: (path) => '/products' + path, // Restore /products prefix
    on: {
      proxyReq: (proxyReq, req) => {
        if ((req as any).user) {
          const authHeader = req.headers.authorization;
          if (authHeader) {
            proxyReq.setHeader('Authorization', authHeader);
          }
        }
        fixRequestBody(proxyReq, req);
      },
      error: (err, req, res) => {
        logger.error({ err }, 'Product service proxy error');
        if (res && typeof (res as any).status === 'function') {
          (res as any).status(503).json({ error: 'Product service unavailable' });
        }
      },
    },
  })
);

router.use(
  '/categories',
  cacheMiddleware(600),
  createProxyMiddleware({
    target: SERVICES.PRODUCT.url,
    changeOrigin: true,
    pathRewrite: (path) => '/categories' + path, // Restore /categories prefix
    on: {
      proxyReq: fixRequestBody,
      error: (err, req, res) => {
        logger.error({ err }, 'Product service proxy error');
        if (res && typeof (res as any).status === 'function') {
          (res as any).status(503).json({ error: 'Product service unavailable' });
        }
      },
    },
  })
);

// Order Service routes
router.use(
  '/orders',
  authMiddleware,
  createProxyMiddleware({
    target: SERVICES.ORDER.url,
    changeOrigin: true,
    pathRewrite: (path) => '/orders' + path, // Restore /orders prefix
    on: {
      proxyReq: fixRequestBody,
      error: (err, req, res) => {
        logger.error({ err }, 'Order service proxy error');
        if (res && typeof (res as any).status === 'function') {
          (res as any).status(503).json({ error: 'Order service unavailable' });
        }
      },
    },
  })
);

// Payment Service routes
router.use(
  '/payments',
  authMiddleware,
  paymentLimiter,
  createProxyMiddleware({
    target: SERVICES.PAYMENT.url,
    changeOrigin: true,
    pathRewrite: (path) => '/payments' + path, // Restore /payments prefix
    on: {
      proxyReq: fixRequestBody,
      error: (err, req, res) => {
        logger.error({ err }, 'Payment service proxy error');
        if (res && typeof (res as any).status === 'function') {
          (res as any).status(503).json({ error: 'Payment service unavailable' });
        }
      },
    },
  })
);

export default router;