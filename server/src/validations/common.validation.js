const Joi = require('joi');
const mongoose = require('mongoose');

// Reusable ObjectId validator for Joi
const objectIdSchema = Joi.string()
  .custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'MongoDB ObjectId')
  .messages({ 'any.invalid': 'Invalid ID format' });

// Reusable pagination query schema
const paginationSchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Generic validate middleware factory
// source: 'body' | 'query' | 'params'
const validate = (schema, source = 'body') => (req, res, next) => {
  const input = source === 'query'
    ? req.query
    : source === 'params'
    ? req.params
    : req.body;

  const { error, value } = schema.validate(input, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: error.details.map((e) => e.message),
      timestamp: new Date().toISOString(),
    });
  }

  if (source === 'query')       req.query  = value;
  else if (source === 'params') req.params = value;
  else                          req.body   = value;

  next();
};

module.exports = { objectIdSchema, paginationSchema, validate };
