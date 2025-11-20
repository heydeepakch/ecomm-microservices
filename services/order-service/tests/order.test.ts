// import request from 'supertest';
// import app from '../src/index';

// describe('Order Service', () => {
//   let authToken: string;
//   let orderId: number;

//   beforeAll(async () => {
//     // Mock auth token for testing
//     authToken = 'mock-jwt-token'; // Replace with actual token in integration tests
//   });

//   describe('POST /orders', () => {
//     it('should create an order', async () => {
//       const orderData = {
//         items: [
//           { productId: 1, quantity: 2 },
//           { productId: 2, quantity: 1 },
//         ],
//         shippingAddress: '123 Main St',
//         shippingCity: 'New York',
//         shippingState: 'NY',
//         shippingZip: '10001',
//       };

//       const response = await request(app)
//         .post('/orders')
//         .set('Authorization', `Bearer ${authToken}`)
//         .send(orderData);

//       expect(response.status).toBe(201);
//       expect(response.body).toHaveProperty('id');
//       expect(response.body.status).toBe('confirmed');
//       orderId = response.body.id;
//     });

//     it('should fail without items', async () => {
//       const response = await request(app)
//         .post('/orders')
//         .set('Authorization', `Bearer ${authToken}`)
//         .send({ shippingAddress: '123 Main St' });

//       expect(response.status).toBe(400);
//     });

//     it('should fail without shipping address', async () => {
//       const response = await request(app)
//         .post('/orders')
//         .set('Authorization', `Bearer ${authToken}`)
//         .send({ items: [{ productId: 1, quantity: 1 }] });

//       expect(response.status).toBe(400);
//     });
//   });

//   describe('GET /orders/:id', () => {
//     it('should get order by ID', async () => {
//       const response = await request(app)
//         .get(`/orders/${orderId}`)
//         .set('Authorization', `Bearer ${authToken}`);

//       expect(response.status).toBe(200);
//       expect(response.body).toHaveProperty('id', orderId);
//       expect(response.body).toHaveProperty('items');
//       expect(Array.isArray(response.body.items)).toBe(true);
//     });

//     it('should return 404 for non-existent order', async () => {
//       const response = await request(app)
//         .get('/orders/999999')
//         .set('Authorization', `Bearer ${authToken}`);

//       expect(response.status).toBe(404);
//     });
//   });

//   describe('GET /orders', () => {
//     it('should get user orders', async () => {
//       const response = await request(app)
//         .get('/orders')
//         .set('Authorization', `Bearer ${authToken}`);

//       expect(response.status).toBe(200);
//       expect(response.body).toHaveProperty('orders');
//       expect(response.body).toHaveProperty('pagination');
//       expect(Array.isArray(response.body.orders)).toBe(true);
//     });

//     it('should support pagination', async () => {
//       const response = await request(app)
//         .get('/orders?page=1&limit=5')
//         .set('Authorization', `Bearer ${authToken}`);

//       expect(response.status).toBe(200);
//       expect(response.body.pagination.page).toBe(1);
//       expect(response.body.pagination.limit).toBe(5);
//     });
//   });

//   describe('POST /orders/:id/cancel', () => {
//     it('should cancel order', async () => {
//       const response = await request(app)
//         .post(`/orders/${orderId}/cancel`)
//         .set('Authorization', `Bearer ${authToken}`);

//       expect(response.status).toBe(200);
//       expect(response.body.order.status).toBe('cancelled');
//     });

//     it('should not cancel already cancelled order', async () => {
//       const response = await request(app)
//         .post(`/orders/${orderId}/cancel`)
//         .set('Authorization', `Bearer ${authToken}`);

//       expect(response.status).toBe(400);
//     });
//   });

//   describe('PUT /orders/:id/status (Admin)', () => {
//     it('should update order status', async () => {
//       // Requires admin token
//       const adminToken = 'mock-admin-token';

//       const response = await request(app)
//         .put(`/orders/${orderId}/status`)
//         .set('Authorization', `Bearer ${adminToken}`)
//         .send({ status: 'processing' });

//       expect(response.status).toBe(200);
//       expect(response.body.status).toBe('processing');
//     });
//   });
// });