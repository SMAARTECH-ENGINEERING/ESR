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

const iotDataSchema = Joi.object({
  deviceId: Joi.string().min(3).max(50).trim().uppercase().required().messages({
    'any.required': 'deviceId is required',
  }),
  flowRate: Joi.number().min(0).required().messages({
    'number.min': 'flowRate cannot be negative',
    'any.required': 'flowRate is required',
  }),
  totalizer: Joi.number().min(0).required().messages({
    'number.min': 'totalizer cannot be negative',
    'any.required': 'totalizer is required',
  }),
  // If not provided, defaults to server time
  timestamp: Joi.date().iso().default(() => new Date()),
});

module.exports = { iotDataSchema, validate };
