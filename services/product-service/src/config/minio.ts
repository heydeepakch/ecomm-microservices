import { Client } from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'product-images';

// Initialize bucket
export async function initializeBucket() {
  try {
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    
    if (!bucketExists) {
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      console.log(`✅ MinIO: Bucket '${BUCKET_NAME}' created`);
      
      // Set public read policy
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`],
          },
        ],
      };
      
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      console.log(`✅ MinIO: Bucket '${BUCKET_NAME}' set to public-read`);
    } else {
      console.log(`✅ MinIO: Bucket '${BUCKET_NAME}' already exists`);
    }
  } catch (error) {
    console.error('❌ MinIO initialization error:', error);
  }
}

export { minioClient, BUCKET_NAME };