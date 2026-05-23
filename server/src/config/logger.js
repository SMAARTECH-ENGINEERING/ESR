const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir   = process.env.LOG_DIR   || 'logs';
const logLevel = process.env.LOG_LEVEL || 'info';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) =>
  `${timestamp} [${level.toUpperCase()}]: ${stack || message}`
);

const rotateOpts = {
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
};

const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new DailyRotateFile({
      ...rotateOpts,
      filename: path.join(logDir, 'error-%DATE%.log'),
      level: 'error',
    }),
    new DailyRotateFile({
      ...rotateOpts,
      filename: path.join(logDir, 'combined-%DATE%.log'),
    }),
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      ...rotateOpts,
      filename: path.join(logDir, 'exceptions-%DATE%.log'),
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      ...rotateOpts,
      filename: path.join(logDir, 'rejections-%DATE%.log'),
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      logFormat
    ),
  }));
}

module.exports = logger;
