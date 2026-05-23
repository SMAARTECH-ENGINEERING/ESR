const authService = require('./auth.service');
const { sendSuccess } = require('../../utils/apiResponse.util');
const logger = require('../../config/logger');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    logger.info(`New user registered: ${req.body.email} [${result.user.role}]`);
    return sendSuccess(res, result, 'User registered successfully', 201);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    logger.info(`User logged in: ${req.body.email}`);
    return sendSuccess(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user._id);
    return sendSuccess(res, user, 'Profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getProfile };
