import { Request, Response } from 'express';
import { UserModel } from '../models/userModel';

export const UserController = {
  // GET /users/internal/:id (for service-to-service calls)
  async getUserInternal(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.id);
      
      const user = await UserModel.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Return user without password
      const { password_hash: _, ...userWithoutPassword } = user as any;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('Get user (internal) error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // GET /users/profile (authenticated)
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

  // PUT /users/profile (authenticated)
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { first_name, last_name } = req.body;

      const user = await UserModel.update(userId, {
        first_name,
        last_name,
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const { password_hash: _, ...userWithoutPassword } = user as any;
      res.json(userWithoutPassword);
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(400).json({ error: error.message });
    }
  },
};