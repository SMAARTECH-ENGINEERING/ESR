const Joi = require('joi');
const { objectIdSchema } = require('../../validations/common.validation');

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
  // Water level from the tank's level transmitter, as a percentage of full capacity.
  // Optional so older devices that don't send it yet still pass validation.
  waterLevelPercent: Joi.number().min(0).max(100).optional().messages({
    'number.min': 'waterLevelPercent cannot be negative',
    'number.max': 'waterLevelPercent cannot exceed 100',
  }),
  // If not provided, defaults to server time
  timestamp: Joi.date().iso().default(() => new Date()),
});

// GET /api/iot/readings
const readingsQuerySchema = Joi.object({
  tankId: objectIdSchema,
  from:   Joi.date().iso(),
  to:     Joi.date().iso().when('from', { is: Joi.exist(), then: Joi.date().min(Joi.ref('from')) }),
  page:   Joi.number().integer().min(1).default(1),
  // Up to 5000 so the UI can export a whole filtered range
  limit:  Joi.number().integer().min(1).max(5000).default(50),
}).messages({ 'date.min': '"to" must be after "from"' });

// GET /api/iot/chart/:tankId
const chartQuerySchema = Joi.object({
  range: Joi.string().valid('day', 'week', 'month', '4months').default('day'),
  from:  Joi.date().iso(),
  to:    Joi.date().iso(),
  tz:    Joi.string().max(64),
});

module.exports = { iotDataSchema, readingsQuerySchema, chartQuerySchema, validate };
