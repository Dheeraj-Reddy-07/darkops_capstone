import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables (this will load the local .env)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and utility middleware
app.use(helmet());
app.use(cors({
  origin: process.env.VITE_FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'DarkOps Express API is running' });
});

// Register API Routes
import authRoutes from './routes/auth.routes';
import casesRoutes from './routes/cases.routes';
import storesRoutes from './routes/stores.routes';
import fraudRoutes from './routes/fraud.routes';
import executiveRoutes from './routes/executive.routes';
import customersRoutes from './routes/customers.routes';
import searchRoutes from './routes/search.routes';
import adminRoutes from './routes/admin.routes';
import notificationsRoutes from './routes/notifications.routes';

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/cases', casesRoutes);
app.use('/api/v1/stores', storesRoutes);
app.use('/api/v1/fraud', fraudRoutes);
app.use('/api/v1/executive', executiveRoutes);
app.use('/api/v1/customers', customersRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

// Centralized error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API Error]', err);
  
  const statusCode = err.statusCode || 500;
  const errorCode = err.errorCode || 'INTERNAL_SERVER_ERROR';
  
  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred.',
      ...(err.details ? { details: err.details } : {})
    }
  });
});

app.listen(PORT, () => {
  console.log(`DarkOps Express server running on port ${PORT}`);
});
