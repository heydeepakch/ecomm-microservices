import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import promClient from 'prom-client';
import paymentRoutes from './routes/paymentRoutes';
import webhookRoutes from './routes/webhookRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import redisClient from './config/redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// Middleware
app.use(helmet());
app.use(cors());

// Webhook route MUST come before json parser (needs raw body)
app.use('/payments', webhookRoutes);

// Now parse JSON for other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging & metrics
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration.toFixed(3)}s`);
  });
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await redisClient.ping();
    res.status(200).json({
      status: 'healthy',
      service: 'payment-service',
      redis: 'connected',
      stripe: 'configured',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'payment-service',
      redis: 'disconnected',
    });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/payments', paymentRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Payment Service running on port ${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/payments/webhook`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await redisClient.quit();
  process.exit(0);
});

export default app;