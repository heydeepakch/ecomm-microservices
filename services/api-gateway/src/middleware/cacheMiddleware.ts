import { Request, Response, NextFunction } from 'express';
import redisClient from '../config/redis';
import logger from '../config/logger';

const DEFAULT_TTL = 300; // 5 minutes

export const cacheMiddleware = (ttl: number = DEFAULT_TTL) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = `gateway:${req.originalUrl}`;

    try {
      // Check cache
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        logger.info({ cacheKey, hit: true }, 'Cache HIT');
        return res.json(JSON.parse(cachedData));
      }

      logger.info({ cacheKey, hit: false }, 'Cache MISS');

      // Intercept response to cache it
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        if (res.statusCode === 200) {
          redisClient
            .setEx(cacheKey, ttl, JSON.stringify(body))
            .catch((err) => logger.error({ err }, 'Cache write error'));
        }
        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error({ error }, 'Cache middleware error');
      next();
    }
  };
};

// Invalidate cache for specific patterns
export const invalidateCache = async (pattern: string) => {
  try {
    const keys = await redisClient.keys(`gateway:${pattern}*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info({ count: keys.length }, 'Cache invalidated');
    }
  } catch (error) {
    logger.error({ error }, 'Cache invalidation error');
  }
};