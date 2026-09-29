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

// Optional IWCRCM mapping — when enabled, id + coordinates are mandatory
const iwcrcmSchema = Joi.object({
  enabled: Joi.boolean().default(false),
  deviceId: Joi.string().trim().uppercase().pattern(/^[A-Z0-9]{1,11}$/).allow('', null)
    .when('enabled', { is: true, then: Joi.required().invalid('', null) })
    .messages({
      'string.pattern.base': 'IWCRCM device ID must be 1-11 characters [A-Z0-9]',
      'any.required': 'IWCRCM device ID is required when IWCRCM is enabled',
      'any.invalid': 'IWCRCM device ID is required when IWCRCM is enabled',
    }),
  longitude: Joi.number().min(-180).max(180).allow(null)
    .when('enabled', { is: true, then: Joi.required().invalid(null) })
    .messages({ 'any.required': 'Longitude is required when IWCRCM is enabled', 'any.invalid': 'Longitude is required when IWCRCM is enabled' }),
  latitude: Joi.number().min(-90).max(90).allow(null)
    .when('enabled', { is: true, then: Joi.required().invalid(null) })
    .messages({ 'any.required': 'Latitude is required when IWCRCM is enabled', 'any.invalid': 'Latitude is required when IWCRCM is enabled' }),
});

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
  iwcrcm: iwcrcmSchema.optional(),
});

const updateTankSchema = Joi.object({
  tankName: Joi.string().min(2).max(100).trim(),
  deviceId: Joi.string().min(3).max(50).trim().uppercase(),
  location: Joi.string().max(200).trim(),
  status:   Joi.string().valid('online', 'offline', 'inactive'),
  iwcrcm:   iwcrcmSchema,
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
});

module.exports = { createTankSchema, updateTankSchema, validate };
