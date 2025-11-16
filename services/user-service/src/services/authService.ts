import bcrypt from 'bcrypt';
import { UserModel } from '../models/userModel';
import { TokenUtils } from '../utils/tokenUtils';

const BCRYPT_ROUNDS = 10;

export const AuthService = {
  // Register new user
  async register(userData: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    role?: 'customer' | 'seller' | 'admin';
  }) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    if (userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(userData.password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(userData.password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(userData.password)) {
      throw new Error('Password must contain at least one special character');
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(userData.password, BCRYPT_ROUNDS);

    // Create user
    const user = await UserModel.create({
      ...userData,
      password_hash,
    });

    // Return user without password
    const { password_hash: _, ...userWithoutPassword } = user as any;
    return userWithoutPassword;
  },

  // Login user
  async login(email: string, password: string) {
    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const accessToken = TokenUtils.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = TokenUtils.generateRefreshToken();
    const refreshTokenExpiry = TokenUtils.getRefreshTokenExpiry();

    // Store refresh token in database
    await UserModel.createRefreshToken(user.id, refreshToken, refreshTokenExpiry);

    // Return tokens and user info
    const { password_hash: _, ...userWithoutPassword } = user as any;
    return {
      user: userWithoutPassword,
      accessToken,
      refreshToken,
    };
  },

  // Refresh access token
  async refreshAccessToken(refreshToken: string) {
    // Find refresh token
    const tokenRecord = await UserModel.findRefreshToken(refreshToken);
    if (!tokenRecord) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get user
    const user = await UserModel.findById(tokenRecord.user_id);
    if (!user || !user.is_active) {
      throw new Error('User not found or inactive');
    }

    // Generate new access token
    const accessToken = TokenUtils.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return { accessToken };
  },

  // Logout user
  async logout(refreshToken: string) {
    await UserModel.revokeRefreshToken(refreshToken);
  },

  // Logout from all devices
  async logoutAll(userId: number) {
    await UserModel.revokeAllUserTokens(userId);
  },
};