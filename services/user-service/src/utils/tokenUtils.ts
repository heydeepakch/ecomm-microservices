import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

export const TokenUtils = {
  // Generate access token
  generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(
        { ...payload },
        JWT_SECRET as jwt.Secret,
        { expiresIn: JWT_EXPIRY as jwt.SignOptions['expiresIn'] }
      );
  },

  // Generate refresh token (just a random string, not JWT)
  generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  },

  // Verify access token
  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  },

  // Calculate refresh token expiry
  getRefreshTokenExpiry(): Date {
    const days = parseInt(JWT_REFRESH_EXPIRY.replace('d', '')) || 7;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  },
};