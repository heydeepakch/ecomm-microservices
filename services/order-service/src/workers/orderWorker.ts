import { Worker } from 'bullmq';
import { OrderModel } from '../models/orderModel';
import userServiceClient from '../clients/userServiceClient';

const connection = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Order worker
const orderWorker = new Worker(
  'orders',
  async (job) => {
    console.log(`Processing job: ${job.name} (${job.id})`);

    try {
      switch (job.name) {
        case 'send-order-confirmation':
          await handleOrderConfirmation(job.data);
          break;

        case 'send-status-update':
          await handleStatusUpdate(job.data);
          break;

        case 'send-tracking-update':
          await handleTrackingUpdate(job.data);
          break;

        default:
          console.log(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      throw error; // BullMQ will retry
    }
  },
  {
    connection,
    concurrency: 5,
  }
);

// Job handlers
async function handleOrderConfirmation(data: {
  orderId: number;
  userId: number;
  totalAmount: number;
}) {
  console.log(`Sending order confirmation for order ${data.orderId}`);

  // In production, fetch user email and send via email service
  // For now, just log
  console.log(`[Email] Order ${data.orderId} confirmed - Total: $${data.totalAmount}`);

  // Update order event
  await OrderModel.logEvent(
    data.orderId,
    'confirmation_email_sent',
    { userId: data.userId },
    true
  );
}

async function handleStatusUpdate(data: { orderId: number; newStatus: string }) {
  console.log(`Sending status update for order ${data.orderId}: ${data.newStatus}`);

  const order = await OrderModel.findById(data.orderId);
  if (order) {
    console.log(
      `[Email] Order ${data.orderId} status updated to: ${data.newStatus}`
    );
  }
}

async function handleTrackingUpdate(data: {
  orderId: number;
  trackingNumber: string;
  carrier: string;
}) {
  console.log(
    `Sending tracking update for order ${data.orderId}: ${data.trackingNumber} (${data.carrier})`
  );

  console.log(
    `[Email] Order ${data.orderId} shipped - Track: ${data.trackingNumber}`
  );
}

// Worker event listeners
orderWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

orderWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

orderWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('✅ Order worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing worker');
  await orderWorker.close();
  process.exit(0);
});

export default orderWorker;