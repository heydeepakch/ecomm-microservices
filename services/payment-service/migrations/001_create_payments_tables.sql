-- Create payment status enum
CREATE TYPE payment_status AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'cancelled',
    'refunded'
);

-- Create payment method enum
CREATE TYPE payment_method AS ENUM (
    'card',
    'bank_transfer',
    'upi',
    'wallet',
    'other'
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER UNIQUE NOT NULL,
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) DEFAULT 'INR',
    status payment_status DEFAULT 'pending',
    payment_method payment_method,
    payment_method_details JSONB,
    
    -- Customer info (from Stripe)
    customer_email VARCHAR(255),
    customer_name VARCHAR(255),
    
    -- Stripe metadata
    stripe_client_secret TEXT,
    stripe_charge_id VARCHAR(255),
    
    -- Error tracking
    error_code VARCHAR(100),
    error_message TEXT,
    
    -- Refund info
    refund_amount DECIMAL(10,2) DEFAULT 0,
    refund_reason TEXT,
    refunded_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    succeeded_at TIMESTAMP,
    failed_at TIMESTAMP
);

-- Create payment events table (for webhook tracking)
CREATE TABLE IF NOT EXISTS payment_events (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

CREATE INDEX idx_payment_events_payment_id ON payment_events(payment_id);
CREATE INDEX idx_payment_events_stripe_event ON payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_processed ON payment_events(processed);

-- Create trigger for updated_at
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE payments IS 'Payment transactions and Stripe payment intents';
COMMENT ON TABLE payment_events IS 'Webhook events from Stripe for idempotency';