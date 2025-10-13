import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { generalRateLimit } from './src/middleware/security';
import { logger } from './src/utils/logger';
import walletRoutes from './src/routes/wallets';
import transactionRoutes from './src/routes/transactions';
import authRoutes from './src/routes/auth';
import rampsRoutes from './src/routes/ramps';
import alchemyRampsRoutes from './src/routes/alchemy.ramps';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4400;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Rate limiting
app.use(generalRateLimit);
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use("/api/ramps", rampsRoutes)
app.use("/api/alchemy/ramps", alchemyRampsRoutes)

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;