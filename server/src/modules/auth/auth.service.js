const User = require('./auth.model');
const { hashPassword, comparePassword } = require('../../utils/bcrypt.util');
const { generateToken } = require('../../utils/jwt.util');
const { AppError } = require('../../middleware/error.middleware');

const register = async ({ name, email, password, role }) => {
  const existing = await User.findOne({ email }).lean();
  if (existing) throw new AppError('Email is already registered', 409);

  const hashed = await hashPassword(password);

  const user = await User.create({
    name,
    email,
    password: hashed,
    role: role || 'control_room',
  });

  const token = generateToken({ id: user._id, role: user.role });

  return {
    user: {
      id:    user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
    token,
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password').lean();

  // Use same error for both cases to prevent user enumeration
  const authError = new AppError('Invalid email or password', 401);
  if (!user) throw authError;

  const valid = await comparePassword(password, user.password);
  if (!valid) throw authError;

  const token = generateToken({ id: user._id, role: user.role });

  return {
    user: {
      id:    user._id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
    token,
  };
};

const getProfile = async (userId) => {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError('User not found', 404);
  return user;
};

module.exports = { register, login, getProfile };
