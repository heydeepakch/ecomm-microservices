import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import promClient from 'prom-client';
import pool from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging & metrics
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration.toFixed(3)}s`);
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'user-service' });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Routes
app.use('/auth', authRoutes);
app.use('/users', authRoutes); // For profile routes

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

async function connectDatabase() {
    try {
      const result = await pool.query('SELECT NOW() as current_time');
      console.log('✅ Database connected at:', result.rows[0].current_time);
    } catch (error: any) {
      console.error('❌ Database connection failed:', error.message);
      console.error('Make sure PostgreSQL is running and DATABASE_URL is correct');
      process.exit(1);
    }
  }
  
  async function startServer() {
    // Connect to database first
    await connectDatabase();
    
    // Then start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 User Service running on port ${PORT}`);
      console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
    });
  }
  
  // Start the server
  startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

export default app;