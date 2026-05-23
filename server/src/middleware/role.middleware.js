const { sendError } = require('../utils/apiResponse.util');

// Usage: authorize('admin') or authorize('admin', 'control_room')
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Access denied. Not authenticated.', 401);
    }

    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied. Role '${req.user.role}' is not authorized for this action.`,
        403
      );
    }

    next();
  };
};

module.exports = { authorize };
