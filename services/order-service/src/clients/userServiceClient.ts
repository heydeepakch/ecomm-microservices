import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';

class UserServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: USER_SERVICE_URL,
      timeout: 5000,
    });
  }

  async getUser(userId: number, token?: string) {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await this.client.get(`/users/${userId}`, { headers });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching user:', error.message);
      throw new Error('User service unavailable');
    }
  }
}

export default new UserServiceClient();