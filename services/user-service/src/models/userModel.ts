import pool from '../config/database';

export interface User {
    id: number;
    email: string;
    password_hash: string;
    first_name?: string;
    last_name?: string;
    role: 'customer' | 'seller' | 'admin';
    is_active: boolean;
    email_verified: boolean;
    created_at: Date;
    updated_at: Date;
  }

export interface RefreshToken {
    id: number;
    user_id: number;
    token: string;
    expires_at: Date;
    is_revoked: boolean;
    createdAt: Date;
}


export const UserModel = {
    // Create a new user
    async create(userData: {
      email: string;
      password_hash: string;
      first_name?: string;
      last_name?: string;
      role?: 'customer' | 'seller' | 'admin';
    }): Promise<User> {
      const query = `
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, first_name, last_name, role, is_active, email_verified, created_at, updated_at
      `;
      const values = [
        userData.email,
        userData.password_hash,
        userData.first_name || null,
        userData.last_name || null,
        userData.role || 'customer',
      ];
  
      const result = await pool.query(query, values);
      return result.rows[0];
    },
  
    // Find user by email
    async findByEmail(email: string): Promise<User | null> {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await pool.query(query, [email]);
      return result.rows[0] || null;
    },
  
    // Find user by ID
    async findById(id: number): Promise<User | null> {
      const query = `
        SELECT id, email, first_name, last_name, role, is_active, email_verified, created_at, updated_at
        FROM users WHERE id = $1
      `;
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    },
  
    // Update user
    async update(
      id: number,
      updates: Partial<Pick<User, 'first_name' | 'last_name' | 'email_verified' | 'is_active'>>
    ): Promise<User | null> {
      const fields = [];
      const values = [];
      let paramCount = 1;
  
      if (updates.first_name !== undefined) {
        fields.push(`first_name = $${paramCount++}`);
        values.push(updates.first_name);
      }
      if (updates.last_name !== undefined) {
        fields.push(`last_name = $${paramCount++}`);
        values.push(updates.last_name);
      }
      if (updates.email_verified !== undefined) {
        fields.push(`email_verified = $${paramCount++}`);
        values.push(updates.email_verified);
      }
      if (updates.is_active !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(updates.is_active);
      }
  
      if (fields.length === 0) return null;
  
      values.push(id);
      const query = `
        UPDATE users SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, first_name, last_name, role, is_active, email_verified, created_at, updated_at
      `;
  
      const result = await pool.query(query, values);
      return result.rows[0] || null;
    },
  
    // Refresh token operations
    async createRefreshToken(userId: number, token: string, expiresAt: Date): Promise<RefreshToken> {
      const query = `
        INSERT INTO refresh_tokens (user_id, token, expires_at)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const result = await pool.query(query, [userId, token, expiresAt]);
      return result.rows[0];
    },
  
    async findRefreshToken(token: string): Promise<RefreshToken | null> {
      const query = `
        SELECT * FROM refresh_tokens
        WHERE token = $1 AND is_revoked = false AND expires_at > NOW()
      `;
      const result = await pool.query(query, [token]);
      return result.rows[0] || null;
    },
  
    async revokeRefreshToken(token: string): Promise<void> {
      const query = 'UPDATE refresh_tokens SET is_revoked = true WHERE token = $1';
      await pool.query(query, [token]);
    },
  
    async revokeAllUserTokens(userId: number): Promise<void> {
      const query = 'UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1';
      await pool.query(query, [userId]);
    },
  };