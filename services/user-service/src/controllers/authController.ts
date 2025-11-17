import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { UserModel } from '../models/userModel';

export const AuthController = {
  // POST /auth/register
  async register(req: Request, res: Response) {
    try {
      const { email, password, first_name, last_name, role } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await AuthService.register({
        email,
        password,
        first_name,
        last_name,
        role,
      });

      res.status(201).json({
        message: 'User registered successfully',
        user,
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // POST /auth/login
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const result = await AuthService.login(email, password);

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  },

  // POST /auth/refresh
  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const result = await AuthService.refreshAccessToken(refreshToken);

      res.status(200).json(result);
    } catch (error: any) {
      console.error('Refresh error:', error);
      res.status(401).json({ error: error.message });
    }
  },

  // POST /auth/logout
  async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      await AuthService.logout(refreshToken);

      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error: any) {
      console.error('Logout error:', error);
      res.status(400).json({ error: error.message });
    }
  },

  // GET /users/profile
  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const user = await UserModel.findById(userId);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { password_hash: _, ...userWithoutPassword } = user as any;
      res.status(200).json(userWithoutPassword);
    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // PUT /users/profile
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { first_name, last_name } = req.body;

      const user = await UserModel.update(userId, { first_name, last_name });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({
        message: 'Profile updated successfully',
        user,
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: error.message });
    }
  },
};