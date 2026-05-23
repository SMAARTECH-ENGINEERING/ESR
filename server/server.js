require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { initializeSocket } = require('./src/config/socket');
const { connectDB } = require('./src/config/database');
const logger = require('./src/config/logger');
const { startCleanupJobs } = require('./src/jobs/cleanup.job');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

initializeSocket(server);

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      logger.info(`ESR Tank Management System started`);
      logger.info(`Environment : ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Port        : ${PORT}`);
      logger.info(`Health Check: http://localhost:${PORT}/health`);
    });

    startCleanupJobs();
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
