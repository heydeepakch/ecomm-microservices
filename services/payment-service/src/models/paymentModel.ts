import pool from '../config/database';

export interface Payment {
  id: number;
  order_id: number;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  payment_method_details?: any;
  customer_email?: string;
  customer_name?: string;
  stripe_client_secret?: string;
  stripe_charge_id?: string;
  error_code?: string;
  error_message?: string;
  refund_amount: number;
  refund_reason?: string;
  refunded_at?: Date;
  created_at: Date;
  updated_at: Date;
  succeeded_at?: Date;
  failed_at?: Date;
}

export const PaymentModel = {
  // Create payment
  async create(paymentData: {
    order_id: number;
    stripe_payment_intent_id: string;
    amount: number;
    currency?: string;
    stripe_client_secret: string;
  }): Promise<Payment> {
    const query = `
      INSERT INTO payments (
        order_id, stripe_payment_intent_id, amount, 
        currency, stripe_client_secret, status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;

    const values = [
      paymentData.order_id,
      paymentData.stripe_payment_intent_id,
      paymentData.amount,
      paymentData.currency || 'INR',
      paymentData.stripe_client_secret,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Find by order ID
  async findByOrderId(orderId: number): Promise<Payment | null> {
    const query = 'SELECT * FROM payments WHERE order_id = $1';
    const result = await pool.query(query, [orderId]);
    return result.rows[0] || null;
  },

  // Find by payment intent ID
  async findByPaymentIntentId(paymentIntentId: string): Promise<Payment | null> {
    const query = 'SELECT * FROM payments WHERE stripe_payment_intent_id = $1';
    const result = await pool.query(query, [paymentIntentId]);
    return result.rows[0] || null;
  },

  // Update payment status
  async updateStatus(
    id: number,
    status: string,
    additionalData?: {
      payment_method?: string;
      payment_method_details?: any;
      customer_email?: string;
      customer_name?: string;
      stripe_charge_id?: string;
      error_code?: string;
      error_message?: string;
    }
  ): Promise<Payment | null> {
    const fields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [status];
    let paramCount = 2;

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = $${paramCount++}`);
          values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        }
      });
    }

    // Set timestamp fields based on status
    if (status === 'succeeded') {
      fields.push('succeeded_at = CURRENT_TIMESTAMP');
    } else if (status === 'failed') {
      fields.push('failed_at = CURRENT_TIMESTAMP');
    }

    values.push(id);
    const query = `
      UPDATE payments 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  // Record refund
  async recordRefund(
    id: number,
    refundAmount: number,
    refundReason?: string
  ): Promise<Payment | null> {
    const query = `
      UPDATE payments 
      SET 
        status = 'refunded',
        refund_amount = $1,
        refund_reason = $2,
        refunded_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [refundAmount, refundReason, id]);
    return result.rows[0] || null;
  },

  // Webhook event tracking
  async hasEventBeenProcessed(stripeEventId: string): Promise<boolean> {
    const query = 'SELECT id FROM payment_events WHERE stripe_event_id = $1';
    const result = await pool.query(query, [stripeEventId]);
    return result.rows.length > 0;
  },

  async recordEvent(
    paymentId: number,
    stripeEventId: string,
    eventType: string,
    eventData: any
  ): Promise<void> {
    const query = `
      INSERT INTO payment_events (
        payment_id, stripe_event_id, event_type, event_data, processed
      )
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (stripe_event_id) DO NOTHING
    `;

    await pool.query(query, [
      paymentId,
      stripeEventId,
      eventType,
      JSON.stringify(eventData),
    ]);
  },

  async markEventProcessed(stripeEventId: string): Promise<void> {
    const query = `
      UPDATE payment_events 
      SET processed = true, processed_at = CURRENT_TIMESTAMP
      WHERE stripe_event_id = $1
    `;

    await pool.query(query, [stripeEventId]);
  },
};