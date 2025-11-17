import pool from '../config/database';

export interface Product {
  id: number;
  seller_id: number;
  category_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  cost_per_item: number | null;
  stock_quantity: number;
  sku: string | null;
  barcode: string | null;
  weight: number | null;
  image_url: string | null;
  images: string[];
  tags: string[] | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  image_url: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export const ProductModel = {
  // Create product
  async create(productData: {
    seller_id: number;
    category_id?: number;
    name: string;
    description?: string;
    price: number;
    stock_quantity?: number;
    sku?: string;
    tags?: string[];
  }): Promise<Product> {
    const slug = productData.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    const query = `
      INSERT INTO products (
        seller_id, category_id, name, slug, description, 
        price, stock_quantity, sku, tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      productData.seller_id,
      productData.category_id || null,
      productData.name,
      slug,
      productData.description || null,
      productData.price,
      productData.stock_quantity || 0,
      productData.sku || null,
      productData.tags || null,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  // Find product by ID
  async findById(id: number): Promise<Product | null> {
    const query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },

  // Find multiple products by IDs
  async findByIds(ids: number[]): Promise<Product[]> {
    const query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ANY($1)
    `;
    const result = await pool.query(query, [ids]);
    return result.rows;
  },

  // Get products with filters and pagination
  async getProducts(filters: {
    page?: number;
    limit?: number;
    category_id?: number;
    seller_id?: number;
    min_price?: number;
    max_price?: number;
    search?: string;
    tags?: string[];
    is_featured?: boolean;
    sort_by?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  }): Promise<{ products: Product[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      category_id,
      seller_id,
      min_price,
      max_price,
      search,
      tags,
      is_featured,
      sort_by = 'newest',
    } = filters;

    const offset = (page - 1) * limit;
    const params: any[] = [];
    let paramCount = 1;

    let query = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = true
    `;

    // Apply filters
    if (category_id) {
      query += ` AND p.category_id = $${paramCount++}`;
      params.push(category_id);
    }

    if (seller_id) {
      query += ` AND p.seller_id = $${paramCount++}`;
      params.push(seller_id);
    }

    if (min_price !== undefined) {
      query += ` AND p.price >= $${paramCount++}`;
      params.push(min_price);
    }

    if (max_price !== undefined) {
      query += ` AND p.price <= $${paramCount++}`;
      params.push(max_price);
    }

    if (search) {
      query += ` AND (
        to_tsvector('english', p.name) @@ plainto_tsquery('english', $${paramCount})
        OR to_tsvector('english', p.description) @@ plainto_tsquery('english', $${paramCount})
        OR p.name ILIKE $${paramCount + 1}
      )`;
      params.push(search, `%${search}%`);
      paramCount += 2;
    }

    if (tags && tags.length > 0) {
      query += ` AND p.tags && $${paramCount++}`;
      params.push(tags);
    }

    if (is_featured !== undefined) {
      query += ` AND p.is_featured = $${paramCount++}`;
      params.push(is_featured);
    }

    // Sorting
    switch (sort_by) {
      case 'price_asc':
        query += ' ORDER BY p.price ASC';
        break;
      case 'price_desc':
        query += ' ORDER BY p.price DESC';
        break;
      case 'newest':
        query += ' ORDER BY p.created_at DESC';
        break;
      case 'popular':
        query += ' ORDER BY p.stock_quantity ASC, p.created_at DESC';
        break;
    }

    // Pagination
    query += ` LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM products WHERE is_active = true`;
    const countResult = await pool.query(countQuery);

    return {
      products: result.rows,
      total: parseInt(countResult.rows[0].count),
    };
  },

  // Update product
  async update(id: number, updates: Partial<Product>): Promise<Product | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (fields.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE products 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },

  // Update stock quantity
  async updateStock(
    id: number,
    quantityChange: number,
    changeType: string,
    referenceId?: number
  ): Promise<Product | null> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current product
      const productResult = await client.query(
        'SELECT * FROM products WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (productResult.rows.length === 0) {
        throw new Error('Product not found');
      }

      const product = productResult.rows[0];
      const quantityBefore = product.stock_quantity;
      const quantityAfter = quantityBefore + quantityChange;

      if (quantityAfter < 0) {
        throw new Error('Insufficient stock');
      }

      // Update stock
      const updateResult = await client.query(
        'UPDATE products SET stock_quantity = $1 WHERE id = $2 RETURNING *',
        [quantityAfter, id]
      );

      // Log inventory change
      await client.query(
        `INSERT INTO inventory_logs 
        (product_id, change_type, quantity_change, quantity_before, quantity_after, reference_id)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, changeType, quantityChange, quantityBefore, quantityAfter, referenceId]
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Soft delete product
  async delete(id: number): Promise<boolean> {
    const result = await pool.query(
      'UPDATE products SET is_active = false WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },

  // Category operations
  async getCategories(): Promise<Category[]> {
    const query = 'SELECT * FROM categories WHERE is_active = true ORDER BY name';
    const result = await pool.query(query);
    return result.rows;
  },

  async getCategoryById(id: number): Promise<Category | null> {
    const query = 'SELECT * FROM categories WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  },
};