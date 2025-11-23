-- Create order status enum
CREATE TYPE order_status AS ENUM (
    'pending',      -- Order created, awaiting confirmation
    'confirmed',    -- Order confirmed, stock reserved
    'paid',         -- Payment successful
    'processing',   -- Being prepared for shipment
    'shipped',      -- Order shipped
    'delivered',    -- Order delivered
    'cancelled',    -- Order cancelled
    'refunded'      -- Order refunded
);

-- Create payment status enum
CREATE TYPE IF NOT EXISTS payment_status AS ENUM (
    'pending',
    'processing',
    'succeeded',  
    'failed',
    'cancelled',  
    'refunded'
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    status order_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    
    -- Pricing
    subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
    tax_amount DECIMAL(10,2) DEFAULT 0 CHECK (tax_amount >= 0),
    shipping_cost DECIMAL(10,2) DEFAULT 0 CHECK (shipping_cost >= 0),
    discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    
    -- Shipping
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(100),
    shipping_state VARCHAR(100),
    shipping_zip VARCHAR(20),
    shipping_country VARCHAR(100) DEFAULT 'US',
    
    -- Tracking
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    
    -- Notes
    customer_notes TEXT,
    internal_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    paid_at TIMESTAMP,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,  -- Reference to product-service
    product_name VARCHAR(255) NOT NULL,  -- Snapshot at order time
    product_sku VARCHAR(100),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_price DECIMAL(10,2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_status_history table (audit trail)
CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    old_status order_status,
    new_status order_status NOT NULL,
    changed_by VARCHAR(100),  -- user_id or 'system'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_events table (for saga pattern)
CREATE TABLE IF NOT EXISTS order_events (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,  -- 'stock_reserved', 'payment_initiated', etc.
    event_data JSONB,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_created_at ON order_status_history(created_at DESC);

CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_order_events_type ON order_events(event_type);

-- Create trigger for updated_at
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update order total when items change
CREATE OR REPLACE FUNCTION calculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders
    SET subtotal = (
        SELECT COALESCE(SUM(total_price), 0)
        FROM order_items
        WHERE order_id = NEW.order_id
    ),
    total_amount = (
        SELECT COALESCE(SUM(total_price), 0) + COALESCE(tax_amount, 0) + COALESCE(shipping_cost, 0) - COALESCE(discount_amount, 0)
        FROM order_items
        WHERE order_id = NEW.order_id
    )
    WHERE id = NEW.order_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate totals
CREATE TRIGGER recalculate_order_total
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION calculate_order_total();

-- Function to log status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
        VALUES (NEW.id, OLD.status, NEW.status, 'system', 'Status changed');
        
        -- Update timestamp fields
        IF NEW.status = 'confirmed' THEN
            NEW.confirmed_at = CURRENT_TIMESTAMP;
        ELSIF NEW.status = 'paid' THEN
            NEW.paid_at = CURRENT_TIMESTAMP;
        ELSIF NEW.status = 'shipped' THEN
            NEW.shipped_at = CURRENT_TIMESTAMP;
        ELSIF NEW.status = 'delivered' THEN
            NEW.delivered_at = CURRENT_TIMESTAMP;
        ELSIF NEW.status = 'cancelled' THEN
            NEW.cancelled_at = CURRENT_TIMESTAMP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for status logging
CREATE TRIGGER log_status_changes
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

COMMENT ON TABLE orders IS 'Customer orders with state machine';
COMMENT ON TABLE order_items IS 'Line items for each order with price snapshot';
COMMENT ON TABLE order_status_history IS 'Audit log of all status changes';
COMMENT ON TABLE order_events IS 'Saga pattern event log for distributed transactions';