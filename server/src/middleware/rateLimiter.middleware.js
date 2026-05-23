const rateLimit = require('express-rate-limit');

// General API limiter
const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    status: 'error',
    message: 'Too many requests from this IP. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    status: 'error',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lenient limiter for IoT device data ingestion
const iotRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    status: 'error',
    message: 'IoT rate limit exceeded.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { globalRateLimiter, authRateLimiter, iotRateLimiter };
