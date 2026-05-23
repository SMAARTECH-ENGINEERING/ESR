const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { globalRateLimiter } = require('./middleware/rateLimiter.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const logger = require('./config/logger');

const authRoutes      = require('./modules/auth/auth.route');
const tankRoutes      = require('./modules/tanks/tank.route');
const dashboardRoutes = require('./modules/dashboard/dashboard.route');
const reportRoutes    = require('./modules/reports/report.route');
const iotRoutes       = require('./modules/iot/iot.route');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Secret'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// Global rate limiter
app.use(globalRateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'ESR Tank Management System is running',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth',      authRoutes);
app.use('/api/tanks',     tankRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/iot',       iotRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler — must be last
app.use(errorHandler);

module.exports = app;
