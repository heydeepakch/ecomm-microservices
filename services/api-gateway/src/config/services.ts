export const SERVICES = {
    USER: {
      name: 'user-service',
      url: process.env.USER_SERVICE_URL || 'http://localhost:3001',
      healthCheck: '/health',
    },
    PRODUCT: {
      name: 'product-service',
      url: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
      healthCheck: '/health',
    },
    ORDER: {
      name: 'order-service',
      url: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
      healthCheck: '/health',
    },
    PAYMENT: {
      name: 'payment-service',
      url: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
      healthCheck: '/health',
    },
  };