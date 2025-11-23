import { Queue, QueueOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

// Parse REDIS_URL or fall back to individual host/port
const getRedisConnection = () => {
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    // Parse redis://host:port format
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
    };
  }
  
  // Fallback to individual env vars
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };
};

const connection = getRedisConnection();

const queueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
};

// Create queues
export const orderQueue = new Queue('orders', queueOptions);
export const emailQueue = new Queue('emails', queueOptions);

console.log('✅ Order queues initialized with Redis:', connection.host + ':' + connection.port);