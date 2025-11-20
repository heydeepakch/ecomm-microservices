import pool from '../config/database';

export interface Order {
  id: number;
  user_id: number;
  status: string;
  payment_status: string;
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  shipping_address: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_zip?: string;
  shipping_country: string;
  tracking_number?: string;
  carrier?: string;
  customer_notes?: string;
  internal_notes?: string;
  created_at: Date;
  updated_at: Date;
  confirmed_at?: Date;
  paid_at?: Date;
  shipped_at?: Date;
  delivered_at?: Date;
  cancelled_at?: Date;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: Date;
}

export const OrderModel = {
  // Create order
  async create(orderData: {
    user_id: number;
    subtotal: number;
    tax_amount?: number;
    shipping_cost?: number;
    discount_amount?: number;
    total_amount: number;
    shipping_address: string;
    shipping_city?: string;
    shipping_state?: string;
    shipping_zip?: string;
    shipping_country?: string;
    customer_notes?: string;
  }): Promise<Order> {
    const query = `
      INSERT INTO orders (
        user_id, subtotal, tax_amount, shipping_cost, 
        discount_amount, total_amount, shipping_address, 
        shipping_city, shipping_state, shipping_zip, 
        shipping_country, customer_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      orderData.user_id,
      orderData.subtotal,
      orderData.tax_amount || 0,
      orderData.shipping_cost || 0,
      orderData.discount_amount || 0,
      orderData.total_amount,
      orderData.shipping_address,
      orderData.shipping_city || null,
      orderData.shipping_state || null,
      orderData.shipping_zip || null,
      orderData.shipping_country || 'US',
      orderData.customer_notes || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Create order item
  async createItem(itemData: {
    order_id: number;
    product_id: number;
    product_name: string;
    product_sku?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }): Promise<OrderItem> {
    const query = `
      INSERT INTO order_items (
        order_id, product_id, product_name, product_sku,
        quantity, unit_price, total_price
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      itemData.order_id,
      itemData.product_id,
      itemData.product_name,
      itemData.product_sku || null,
      itemData.quantity,
      itemData.unit_price,
      itemData.total_price,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Find order by ID
  async findById(id: number): Promise<Order | null> {
    const query = 'SELECT * FROM orders WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  // Find order with items
  async findByIdWithItems(id: number): Promise<(Order & { items: OrderItem[] }) | null> {
    const orderQuery = 'SELECT * FROM orders WHERE id = $1';
    const orderResult = await pool.query(orderQuery, [id]);

    if (orderResult.rows.length === 0) {
      return null;
    }

    const itemsQuery = 'SELECT * FROM order_items WHERE order_id = $1';
    const itemsResult = await pool.query(itemsQuery, [id]);

    return {
      ...orderResult.rows[0],
      items: itemsResult.rows,
    };
  },

  // Get user orders
  async findByUserId(
    userId: number,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ orders: Order[]; total: number }> {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const query = `
      SELECT * FROM orders 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;

    const countQuery = 'SELECT COUNT(*) FROM orders WHERE user_id = $1';

    const [ordersResult, countResult] = await Promise.all([
      pool.query(query, [userId, limit, offset]),
      pool.query(countQuery, [userId]),
    ]);

    return {
      orders: ordersResult.rows,
      total: parseInt(countResult.rows[0].count),
    };
  },

  // Update order status
  async updateStatus(id: number, status: string): Promise<Order | null> {
    const query = `
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, id]);
    return result.rows[0] || null;
  },

  // Update payment status
  async updatePaymentStatus(id: number, paymentStatus: string): Promise<Order | null> {
    const query = `
      UPDATE orders 
      SET payment_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [paymentStatus, id]);
    return result.rows[0] || null;
  },

  // Add tracking info
  async updateTracking(
    id: number,
    trackingNumber: string,
    carrier: string
  ): Promise<Order | null> {
    const query = `
      UPDATE orders 
      SET tracking_number = $1, carrier = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [trackingNumber, carrier, id]);
    return result.rows[0] || null;
  },

  // Log order event (for saga pattern)
  async logEvent(
    orderId: number,
    eventType: string,
    eventData: any,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    const query = `
      INSERT INTO order_events (order_id, event_type, event_data, success, error_message)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await pool.query(query, [
      orderId,
      eventType,
      JSON.stringify(eventData),
      success,
      errorMessage || null,
    ]);
  },

  // Get order history
  async getStatusHistory(orderId: number) {
    const query = `
      SELECT * FROM order_status_history 
      WHERE order_id = $1 
      ORDER BY created_at ASC
    `;

    const result = await pool.query(query, [orderId]);
    return result.rows;
  },
};