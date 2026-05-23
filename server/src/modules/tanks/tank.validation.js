const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
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

  req.body = value;
  next();
};

const createTankSchema = Joi.object({
  tankName: Joi.string().min(2).max(100).trim().required().messages({
    'string.min': 'Tank name must be at least 2 characters',
    'string.max': 'Tank name cannot exceed 100 characters',
    'any.required': 'Tank name is required',
  }),
  deviceId: Joi.string().min(3).max(50).trim().uppercase().required().messages({
    'any.required': 'Device ID is required',
  }),
  location: Joi.string().max(200).trim().required().messages({
    'any.required': 'Location is required',
  }),
  status: Joi.string().valid('online', 'offline', 'inactive').default('inactive'),
});

const updateTankSchema = Joi.object({
  tankName: Joi.string().min(2).max(100).trim(),
  deviceId: Joi.string().min(3).max(50).trim().uppercase(),
  location: Joi.string().max(200).trim(),
  status:   Joi.string().valid('online', 'offline', 'inactive'),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

module.exports = { createTankSchema, updateTankSchema, validate };
