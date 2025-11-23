import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3003';

class OrderServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ORDER_SERVICE_URL,
      timeout: 5000,
    });
  }

  async getOrder(orderId: number) {
    try {
      // Use internal endpoint (no auth required)
      const response = await this.client.get(`/orders/internal/${orderId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching order:', error.message);
      throw new Error('Order service unavailable');
    }
  }

  async updateOrderStatus(orderId: number, status: string) {
    try {
      // Use internal endpoint or add service token
      const response = await this.client.put(`/orders/internal/${orderId}/status`, {
        status,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error updating order status:', error.message);
      throw new Error('Failed to update order status');
    }
  }

  async updatePaymentStatus(orderId: number, paymentStatus: string) {
    try {
      console.log(`[OrderClient] Updating payment_status for order ${orderId} to '${paymentStatus}'`);
      const response = await this.client.put(`/orders/internal/${orderId}/payment-status`, {
        payment_status: paymentStatus,
      });
      console.log(`[OrderClient] Payment status updated successfully:`, response.data);
      return response.data;
    } catch (error: any) {
      // Log the full error details
      console.error('[OrderClient] Error updating payment status:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
      });
      
      // Include the actual error message from order service
      const errorMessage = error.response?.data?.error || error.message;
      throw new Error(`Failed to update payment status: ${errorMessage}`);
    }
  }
}

export default new OrderServiceClient();