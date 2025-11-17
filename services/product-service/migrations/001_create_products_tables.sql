CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER NOT NULL,  -- References users.id from user-service
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    compare_at_price DECIMAL(10,2) CHECK (compare_at_price >= price),
    cost_per_item DECIMAL(10,2) CHECK (cost_per_item >= 0),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    sku VARCHAR(100) UNIQUE,
    barcode VARCHAR(100),
    weight DECIMAL(10,2), -- in kg
    image_url VARCHAR(500),
    images JSONB DEFAULT '[]'::jsonb, -- Array of image URLs
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory_logs table for audit trail
CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- 'restock', 'sale', 'return', 'adjustment'
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reference_id INTEGER, -- order_id or other reference
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create product_reviews table (bonus feature)
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_seller ON products(seller_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_is_featured ON products(is_featured);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_stock ON products(stock_quantity);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- Full-text search indexes
CREATE INDEX idx_products_name_gin ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_products_desc_gin ON products USING gin(to_tsvector('english', description));
CREATE INDEX idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- Index for tags (GIN for array operations)
CREATE INDEX idx_products_tags ON products USING gin(tags);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_created_at ON inventory_logs(created_at DESC);

CREATE INDEX idx_reviews_product ON product_reviews(product_id);
CREATE INDEX idx_reviews_user ON product_reviews(user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON product_reviews
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-generate slug
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN lower(
        regexp_replace(
            regexp_replace(text_input, '[^a-zA-Z0-9\s-]', '', 'g'),
            '\s+', '-', 'g'
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Insert default categories
INSERT INTO categories (name, slug, description) VALUES
    ('Electronics', 'electronics', 'Electronic devices, gadgets, and accessories'),
    ('Computers & Laptops', 'computers-laptops', 'Desktop computers, laptops, and computer accessories'),
    ('Mobile Phones', 'mobile-phones', 'Smartphones, feature phones, and mobile accessories'),
    ('Clothing', 'clothing', 'Apparel and fashion items for all'),
    ('Men''s Clothing', 'mens-clothing', 'Clothing for men'),
    ('Women''s Clothing', 'womens-clothing', 'Clothing for women'),
    ('Books', 'books', 'Physical and digital books'),
    ('Home & Garden', 'home-garden', 'Home decor, furniture, and garden supplies'),
    ('Sports & Outdoors', 'sports-outdoors', 'Sports equipment, outdoor gear, and fitness items'),
    ('Beauty & Personal Care', 'beauty-personal-care', 'Cosmetics, skincare, and personal care products')
ON CONFLICT (name) DO NOTHING;

-- Set parent categories (hierarchy)
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'electronics') WHERE slug IN ('computers-laptops', 'mobile-phones');
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE slug = 'clothing') WHERE slug IN ('mens-clothing', 'womens-clothing');

-- Insert sample products
INSERT INTO products (seller_id, category_id, name, slug, description, price, stock_quantity, sku) VALUES
    (1, (SELECT id FROM categories WHERE slug = 'computers-laptops'), 'MacBook Pro 14"', 'macbook-pro-14', 'Apple MacBook Pro 14-inch with M3 chip, 16GB RAM, 512GB SSD', 1999.99, 10, 'MBP-14-M3-16-512'),
    (1, (SELECT id FROM categories WHERE slug = 'computers-laptops'), 'Dell XPS 13', 'dell-xps-13', 'Dell XPS 13 laptop with Intel Core i7, 16GB RAM, 512GB SSD', 1299.99, 15, 'DELL-XPS13-I7'),
    (1, (SELECT id FROM categories WHERE slug = 'mobile-phones'), 'iPhone 15 Pro', 'iphone-15-pro', 'Apple iPhone 15 Pro with A17 Pro chip, 256GB storage', 999.99, 25, 'IP15-PRO-256'),
    (1, (SELECT id FROM categories WHERE slug = 'mobile-phones'), 'Samsung Galaxy S24', 'samsung-galaxy-s24', 'Samsung Galaxy S24 with Snapdragon 8 Gen 3, 256GB', 899.99, 20, 'SGS24-256'),
    (1, (SELECT id FROM categories WHERE slug = 'books'), 'The Pragmatic Programmer', 'pragmatic-programmer', 'Your Journey to Mastery, 20th Anniversary Edition', 49.99, 50, 'BOOK-PRAGPROG-20'),
    (1, (SELECT id FROM categories WHERE slug = 'home-garden'), 'Smart LED Bulb 4-Pack', 'smart-led-bulb-4pack', 'WiFi enabled smart LED bulbs, voice control compatible', 39.99, 100, 'LED-SMART-4PK')
ON CONFLICT (sku) DO NOTHING;

COMMENT ON TABLE categories IS 'Product categories with hierarchical support';
COMMENT ON TABLE products IS 'Product catalog with inventory management';
COMMENT ON TABLE inventory_logs IS 'Audit log for inventory changes';
COMMENT ON TABLE product_reviews IS 'Customer reviews and ratings for products';