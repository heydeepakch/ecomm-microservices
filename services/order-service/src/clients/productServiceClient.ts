import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

interface Product {
    id: number;
    name: string;
    sku: string;
    price: number;
    stock_quantity: number;
  }

class ProductServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: PRODUCT_SERVICE_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add retry logic
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        if (!config || !config.retry) {
          config.retry = 0;
        }
        
        if (config.retry < 3 && this.shouldRetry(error)) {
          config.retry += 1;
          const delay = Math.pow(2, config.retry) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.client(config);
        }
        
        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: any): boolean {
    return (
      error.code === 'ECONNABORTED' ||
      error.code === 'ETIMEDOUT' ||
      (error.response && error.response.status >= 500)
    );
  }

  

  async getProducts(productIds: number[]): Promise<Product[]> {
    try {
      const response = await this.client.get('/products/bulk', {
        params: { ids: productIds.join(',') },
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching products:', error.message);
      throw new Error('Product service unavailable');
    }
  }

  async getProduct(productId: number) {
    try {
      const response = await this.client.get(`/products/${productId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Product not found');
      }
      console.error('Error fetching product:', error.message);
      throw new Error('Product service unavailable');
    }
  }

  async reserveStock(productId: number, quantity: number, orderId: number) {
    try {
      const response = await this.client.post(`/products/${productId}/reserve`, {
        quantity,
        orderId,
        idempotencyKey: `order-${orderId}-product-${productId}`,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error reserving stock:', error.message);
      if (error.response?.status === 400) {
        throw new Error(error.response.data.error || 'Insufficient stock');
      }
      throw new Error('Failed to reserve stock');
    }
  }

  async releaseStock(productId: number, quantity: number, orderId: number) {
    try {
      const response = await this.client.post(`/products/${productId}/release`, {
        quantity,
        orderId,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error releasing stock:', error.message);
      throw new Error('Failed to release stock');
    }
  }
}

export default new ProductServiceClient();