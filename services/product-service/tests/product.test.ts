// import request from 'supertest';
// import app from '../src/index';

// describe('Product Service', () => {
//   let authToken: string;
//   let productId: number;

//   beforeAll(async () => {
//     // Get auth token from user service (or mock it)
//     // For now, we'll mock a JWT token
//     authToken = 'mock-jwt-token'; // Replace with actual token in integration tests
//   });

//   describe('GET /products', () => {
//     it('should return a list of products', async () => {
//       const response = await request(app).get('/products');

//       expect(response.status).toBe(200);
//       expect(response.body).toHaveProperty('products');
//       expect(response.body).toHaveProperty('pagination');
//       expect(Array.isArray(response.body.products)).toBe(true);
//     });

//     it('should filter products by category', async () => {
//       const response = await request(app).get('/products?category=1');

//       expect(response.status).toBe(200);
//       expect(response.body.products.length).toBeGreaterThanOrEqual(0);
//     });

//     it('should filter products by price range', async () => {
//       const response = await request(app).get('/products?minPrice=100&maxPrice=1000');

//       expect(response.status).toBe(200);
//       response.body.products.forEach((product: any) => {
//         expect(product.price).toBeGreaterThanOrEqual(100);
//         expect(product.price).toBeLessThanOrEqual(1000);
//       });
//     });

//     it('should search products by name', async () => {
//       const response = await request(app).get('/products?search=laptop');

//       expect(response.status).toBe(200);
//       expect(response.body.products.length).toBeGreaterThanOrEqual(0);
//     });

//     it('should paginate results', async () => {
//       const response = await request(app).get('/products?page=1&limit=5');

//       expect(response.status).toBe(200);
//       expect(response.body.products.length).toBeLessThanOrEqual(5);
//       expect(response.body.pagination.page).toBe(1);
//       expect(response.body.pagination.limit).toBe(5);
//     });
//   });

//   describe('GET /products/:id', () => {
//     it('should return a single product', async () => {
//       const response = await request(app).get('/products/1');

//       expect(response.status).toBe(200);
//       expect(response.body).toHaveProperty('id');
//       expect(response.body).toHaveProperty('name');
//       expect(response.body).toHaveProperty('price');
//     });

//     it('should return 404 for non-existent product', async () => {
//       const response = await request(app).get('/products/999999');

//       expect(response.status).toBe(404);
//     });
//   });

//   describe('POST /products', () => {
//     it('should create a new product with valid auth', async () => {
//       const newProduct = {
//         name: 'Test Product',
//         description: 'A test product',
//         price: 99.99,
//         stock_quantity: 10,
//         category_id: 1,
//       };

//       const response = await request(app)
//         .post('/products')
//         .set('Authorization', `Bearer ${authToken}`)
//         .send(newProduct);

//       expect(response.status).toBe(201);
//       expect(response.body).toHaveProperty('id');
//       expect(response.body.name).toBe(newProduct.name);
//       productId = response.body.id;
//     });

//     it('should fail without authentication', async () => {
//       const response = await request(app).post('/products').send({
//         name: 'Test Product',
//         price: 99.99,
//       });

//       expect(response.status).toBe(401);
//     });
//   });

//   describe('PUT /products/:id', () => {
//     it('should update a product', async () => {
//       const updates = {
//         name: 'Updated Test Product',
//         price: 149.99,
//       };

//       const response = await request(app)
//         .put(`/products/${productId}`)
//         .set('Authorization', `Bearer ${authToken}`)
//         .send(updates);

//       expect(response.status).toBe(200);
//       expect(response.body.name).toBe(updates.name);
//       expect(parseFloat(response.body.price)).toBe(updates.price);
//     });
//   });

//   describe('Stock Management', () => {
//     it('should reserve stock', async () => {
//       const response = await request(app).post(`/products/${productId}/reserve`).send({
//         quantity: 2,
//         orderId: 1,
//         idempotencyKey: 'test-order-1',
//       });

//       expect(response.status).toBe(200);
//       expect(response.body.success).toBe(true);
//     });

//     it('should prevent double reservation with idempotency', async () => {
//       const response1 = await request(app).post(`/products/${productId}/reserve`).send({
//         quantity: 1,
//         orderId: 2,
//         idempotencyKey: 'test-order-2',
//       });

//       const response2 = await request(app).post(`/products/${productId}/reserve`).send({
//         quantity: 1,
//         orderId: 2,
//         idempotencyKey: 'test-order-2', // Same key
//       });

//       expect(response1.status).toBe(200);
//       expect(response2.status).toBe(200);
//       expect(response1.body).toEqual(response2.body);
//     });

//     it('should release stock', async () => {
//       const response = await request(app).post(`/products/${productId}/release`).send({
//         quantity: 1,
//         orderId: 1,
//       });

//       expect(response.status).toBe(200);
//       expect(response.body.success).toBe(true);
//     });
//   });

//   describe('DELETE /products/:id', () => {
//     it('should soft delete a product', async () => {
//       const response = await request(app)
//         .delete(`/products/${productId}`)
//         .set('Authorization', `Bearer ${authToken}`);

//       expect(response.status).toBe(200);
//     });

//     it('should not show deleted product in listings', async () => {
//       const response = await request(app).get('/products');

//       const deletedProduct = response.body.products.find((p: any) => p.id === productId);
//       expect(deletedProduct).toBeUndefined();
//     });
//   });

//   describe('GET /categories', () => {
//     it('should return all categories', async () => {
//       const response = await request(app).get('/categories');

//       expect(response.status).toBe(200);
//       expect(Array.isArray(response.body)).toBe(true);
//       expect(response.body.length).toBeGreaterThan(0);
//     });
//   });
// });