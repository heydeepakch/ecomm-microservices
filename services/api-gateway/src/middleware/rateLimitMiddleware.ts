import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis';

// General rate limiter
export const generalLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore - type mismatch between packages
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for auth endpoints
export const authLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: 'auth_limit:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Aggressive limiter for payment endpoints
export const paymentLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: 'payment_limit:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,// 10 payment attempts per hour
  message: { error: 'Payment rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});