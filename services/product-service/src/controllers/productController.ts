import { Request, Response } from 'express';
import { ProductService } from '../services/productService';
import redisClient from '../config/redis';

export const ProductController = {
  // GET /products
  async getProducts(req: Request, res: Response) {
    try {
      const filters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        category_id: req.query.category ? parseInt(req.query.category as string) : undefined,
        seller_id: req.query.seller ? parseInt(req.query.seller as string) : undefined,
        min_price: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        max_price: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        search: req.query.search as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        is_featured: req.query.featured === 'true',
        sort_by: req.query.sortBy as any,
      };

      const result = await ProductService.getProducts(filters);
      res.json(result);
    } catch (error: any) {
      console.error('Get products error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // GET /products/:id
  async getProduct(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const product = await ProductService.getProductById(id);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(product);
    } catch (error: any) {
      console.error('Get product error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // GET /products/bulk (for order service)
  async getBulkProducts(req: Request, res: Response) {
    try {
      const ids = (req.query.ids as string)
        .split(',')
        .map((id) => parseInt(id));

      const products = await ProductService.getProductsByIds(ids);
      res.json(products);
    } catch (error: any) {
      console.error('Get bulk products error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // POST /products
  async createProduct(req: Request, res: Response) {
    try {
      const sellerId = (req as any).user.userId;
      const productData = {
        ...req.body,
        seller_id: sellerId,
      };

      const product = await ProductService.createProduct(productData);
      res.status(201).json(product);
    } catch (error: any) {
      console.error('Create product error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // PUT /products/:id
  async updateProduct(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const userId = (req as any).user.userId;
      const userRole = (req as any).user.role;

      // Check ownership (unless admin)
      if (userRole !== 'admin') {
        const existingProduct = await ProductService.getProductById(id);
        if (!existingProduct || existingProduct.seller_id !== userId) {
          return res.status(403).json({ error: 'Not authorized to update this product' });
        }
      }

      const product = await ProductService.updateProduct(id, req.body);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json(product);
    } catch (error: any) {
      console.error('Update product error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // DELETE /products/:id
  async deleteProduct(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const userId = (req as any).user.userId;
      const userRole = (req as any).user.role;

      // Check ownership (unless admin)
      if (userRole !== 'admin') {
        const existingProduct = await ProductService.getProductById(id);
        if (!existingProduct || existingProduct.seller_id !== userId) {
          return res.status(403).json({ error: 'Not authorized to delete this product' });
        }
      }

      const result = await ProductService.deleteProduct(id);

      if (!result) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ message: 'Product deleted successfully' });
    } catch (error: any) {
      console.error('Delete product error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // POST /products/:id/upload-image
  async uploadImage(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const imageUrl = await ProductService.uploadImage(id, file.buffer, file.mimetype);
      res.json({ imageUrl });
    } catch (error: any) {
      console.error('Upload image error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // POST /products/:id/reserve (internal - for order service)
  async reserveStock(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      const { quantity, orderId, idempotencyKey } = req.body;

      if (!quantity || !orderId || !idempotencyKey) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check idempotency
      const cached = await redisClient.get(`idempotency:${idempotencyKey}`); 
      if (cached) {
        return res.json(JSON.parse(cached));
      }

      const product = await ProductService.reserveStock(productId, quantity, orderId);

      if (!product) {
        return res.status(400).json({ error: 'Failed to reserve stock' });
      }

      const response = {
        success: true,
        productId,
        remainingStock: product.stock_quantity,
      };

      // Cache idempotency response
      await redisClient.setEx(
        `idempotency:${idempotencyKey}`,
        86400,
        JSON.stringify(response)
      );

      res.json(response);
    } catch (error: any) {
      console.error('Reserve stock error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // POST /products/:id/release (internal - for cancelled orders)
  async releaseStock(req: Request, res: Response) {
    try {
      const productId = parseInt(req.params.id);
      const { quantity, orderId } = req.body;

      const product = await ProductService.releaseStock(productId, quantity, orderId);

      if (!product) {
        return res.status(400).json({ error: 'Failed to release stock' });
      }

      res.json({
        success: true,
        productId,
        newStock: product.stock_quantity,
      });
    } catch (error: any) {
      console.error('Release stock error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // GET /categories
  async getCategories(req: Request, res: Response) {
    try {
      const categories = await ProductService.getCategories();
      res.json(categories);
    } catch (error: any) {
      console.error('Get categories error:', error);
      res.status(500).json({ error: error.message });
    }
  },
};