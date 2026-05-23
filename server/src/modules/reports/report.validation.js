const Joi = require('joi');

const dailyQuerySchema = Joi.object({
  date: Joi.date().iso().messages({
    'date.format': 'date must be a valid ISO 8601 date (e.g. 2026-05-22)',
  }),
});

const weeklyQuerySchema = Joi.object({
  startDate: Joi.date().iso().messages({
    'date.format': 'startDate must be a valid ISO 8601 date',
  }),
});

const monthlyQuerySchema = Joi.object({
  year:  Joi.number().integer().min(2020).max(2100),
  month: Joi.number().integer().min(1).max(12),
});

module.exports = { dailyQuerySchema, weeklyQuerySchema, monthlyQuerySchema };
