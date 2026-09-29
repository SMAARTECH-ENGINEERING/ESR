require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { initializeSocket } = require('./src/config/socket');
const { connectDB } = require('./src/config/database');
const logger = require('./src/config/logger');
const { startCleanupJobs } = require('./src/jobs/cleanup.job');
const { startIwcrcmJob } = require('./src/jobs/iwcrcm.job');
const { ensureRetentionIndexes, getRetentionDays } = require('./src/config/retention');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

initializeSocket(server);

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, '0.0.0.0', () => {
      logger.info(`ESR Tank Management System started`);
      logger.info(`Environment : ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Port        : ${PORT}`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
    });

    // Apply DATA_RETENTION_DAYS to TTL indexes (replaces the legacy 90-day index)
    await ensureRetentionIndexes();
    logger.info(`Data retention: ${getRetentionDays()} days`);

    startCleanupJobs();

    // IWCRCM failures must never stop local monitoring
    try {
      startIwcrcmJob();
    } catch (error) {
      logger.error(`IWCRCM integration failed to start: ${error.message}`);
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION:', err.message, err.stack);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err.message, err.stack);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();
