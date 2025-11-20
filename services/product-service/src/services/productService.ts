import { ProductModel, Product } from '../models/productModel';
import redisClient from '../config/redis';
import { minioClient, BUCKET_NAME } from '../config/minio';
import sharp from 'sharp';

const CACHE_TTL = 300; // 5 minutes

export const ProductService = {
  // Get products with caching
  async getProducts(filters: any) {
    const cacheKey = `products:list:${JSON.stringify(filters)}`;

    try {
      // Check cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log('Cache HIT:', cacheKey);
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis error:', error);
    }

    // Fetch from database
    const result = await ProductModel.getProducts(filters);

    const response = {
      products: result.products,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total: result.total,
        totalPages: Math.ceil(result.total / (filters.limit || 20)),
      },
    };

    // Cache result
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(response));
    } catch (error) {
      console.error('Redis cache error:', error);
    }

    return response;
  },

  // Get single product with caching
  async getProductById(id: number) {
    const cacheKey = `products:detail:${id}`;

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log('Cache HIT:', cacheKey);
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis error:', error);
    }

    const product = await ProductModel.findById(id);

    if (product) {
      try {
        await redisClient.setEx(cacheKey, CACHE_TTL * 2, JSON.stringify(product));
      } catch (error) {
        console.error('Redis cache error:', error);
      }
    }

    return product;
  },

  // Get multiple products (bulk)
  async getProductsByIds(ids: number[]) {
    return ProductModel.findByIds(ids);
  },

  // Create product
  async createProduct(productData: any) {
    const product = await ProductModel.create(productData);

    // Invalidate list cache
    await this.invalidateListCache();

    return product;
  },

  // Update product
  async updateProduct(id: number, updates: any) {
    const product = await ProductModel.update(id, updates);

    if (product) {
      // Invalidate caches
      await this.invalidateProductCache(id);
      await this.invalidateListCache();
    }

    return product;
  },

  // Reserve stock (for orders)
  async reserveStock(productId: number, quantity: number, orderId: number) {
    const product = await ProductModel.updateStock(
      productId,
      -quantity,
      'sale',
      orderId
    );

    if (product) {
      // Invalidate caches
      await this.invalidateProductCache(productId);
      await this.invalidateListCache();
    }

    return product;
  },

  // Release stock (for cancelled orders)
  async releaseStock(productId: number, quantity: number, orderId: number) {
    const product = await ProductModel.updateStock(
      productId,
      quantity,
      'return',
      orderId
    );

    if (product) {
      await this.invalidateProductCache(productId);
      await this.invalidateListCache();
    }

    return product;
  },

  // Upload image to MinIO
  async uploadImage(
    productId: number,
    imageBuffer: Buffer,
    mimetype: string
  ): Promise<string> {
    // Optimize image
    const optimizedImage = await sharp(imageBuffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate filename
    const filename = `product-${productId}-${Date.now()}.jpg`;

    // Upload to MinIO
    await minioClient.putObject(
      BUCKET_NAME,
      filename,
      optimizedImage,
      optimizedImage.length,
      {
        'Content-Type': 'image/jpeg',
      }
    );

    // Generate URL
    const imageUrl = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${BUCKET_NAME}/${filename}`;

    // Update product
    await ProductModel.update(productId, { image_url: imageUrl });

    // Invalidate cache
    await this.invalidateProductCache(productId);

    return imageUrl;
  },

  // Delete product
  async deleteProduct(id: number) {
    const result = await ProductModel.delete(id);

    if (result) {
      await this.invalidateProductCache(id);
      await this.invalidateListCache();
    }

    return result;
  },

  // Get categories
  async getCategories() {
    const cacheKey = 'categories:all';

    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Redis error:', error);
    }

    const categories = await ProductModel.getCategories();

    try {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(categories)); // 1 hour
    } catch (error) {
      console.error('Redis cache error:', error);
    }

    return categories;
  },

  // Cache invalidation helpers
  async invalidateProductCache(productId: number) {
    try {
      await redisClient.del(`products:detail:${productId}`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  },

  async invalidateListCache() {
    try {
      const keys = await redisClient.keys('products:list:*');
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  },
};