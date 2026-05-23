const { verifyToken } = require('../utils/jwt.util');
const User = require('../modules/auth/auth.model');
const { sendError } = require('../utils/apiResponse.util');
const logger = require('../config/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Access denied. No token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) return sendError(res, 'Access denied. Invalid token format.', 401);

    const decoded = verifyToken(token);

    const user = await User.findById(decoded.id).select('-password').lean();
    if (!user) return sendError(res, 'Access denied. User not found.', 401);

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Access denied. Token has expired.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 'Access denied. Invalid token.', 401);
    }
    logger.error('Authentication middleware error:', error);
    return sendError(res, 'Authentication failed.', 500);
  }
};

module.exports = { authenticate };
