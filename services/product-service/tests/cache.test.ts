import request from 'supertest';
import app from '../src/index';
import redisClient from '../src/config/redis';

describe('Cache Tests', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await redisClient.flushAll();
  });

  it('should cache product list on first request', async () => {
    const start1 = Date.now();
    const response1 = await request(app).get('/products?page=1&limit=10');
    const duration1 = Date.now() - start1;

    const start2 = Date.now();
    const response2 = await request(app).get('/products?page=1&limit=10');
    const duration2 = Date.now() - start2;

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(response1.body).toEqual(response2.body);
    expect(duration2).toBeLessThan(duration1); // Cached request should be faster
  });

  it('should invalidate cache on product update', async () => {
    // First request - populates cache
    await request(app).get('/products/1');

    // Update product
    await request(app)
      .put('/products/1')
      .set('Authorization', 'Bearer mock-token')
      .send({ price: 999.99 });

    // Second request - should fetch fresh data
    const response = await request(app).get('/products/1');
    expect(response.status).toBe(200);
    expect(parseFloat(response.body.price)).toBe(999.99);
  });
});