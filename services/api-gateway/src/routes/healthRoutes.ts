import { Router, Request, Response } from 'express';
import axios from 'axios';
import { SERVICES } from '../config/services';
import redisClient from '../config/redis';

const router = Router();

// Check individual service health
async function checkServiceHealth(serviceName: string, url: string, healthPath: string) {
  try {
    const response = await axios.get(`${url}${healthPath}`, { timeout: 3000 });
    return {
      name: serviceName,
      status: 'healthy',
      responseTime: response.headers['x-response-time'] || 'N/A',
    };
  } catch (error) {
    return {
      name: serviceName,
      status: 'unhealthy',
      error: (error as Error).message,
    };
  }
}

// Gateway health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    await redisClient.ping();

    res.status(200).json({
      status: 'healthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      redis: 'connected',
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
      redis: 'disconnected',
    });
  }
});

// Aggregated health check
router.get('/health/all', async (req: Request, res: Response) => {
  const healthChecks = await Promise.all([
    checkServiceHealth(SERVICES.USER.name, SERVICES.USER.url, SERVICES.USER.healthCheck),
    checkServiceHealth(SERVICES.PRODUCT.name, SERVICES.PRODUCT.url, SERVICES.PRODUCT.healthCheck),
    checkServiceHealth(SERVICES.ORDER.name, SERVICES.ORDER.url, SERVICES.ORDER.healthCheck),
    checkServiceHealth(SERVICES.PAYMENT.name, SERVICES.PAYMENT.url, SERVICES.PAYMENT.healthCheck),
  ]);

  // Check Redis
  let redisStatus = 'healthy';
  try {
    await redisClient.ping();
  } catch {
    redisStatus = 'unhealthy';
  }

  const allHealthy = healthChecks.every((check) => check.status === 'healthy') && redisStatus === 'healthy';

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: healthChecks,
    redis: redisStatus,
  });
});

export default router;