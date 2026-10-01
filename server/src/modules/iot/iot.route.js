const express = require('express');
const { receiveData, getLatestReading, getLiveHistory, getReadings, getChartData } = require('./iot.controller');
const { iotDataSchema, readingsQuerySchema, chartQuerySchema, validate } = require('./iot.validation');
const { validate: validateRequest, objectIdSchema } = require('../../validations/common.validation');
const Joi = require('joi');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { verifyDeviceSecret } = require('../../middleware/iot.middleware');

const router = express.Router();

// POST /api/iot/data — called by IoT devices (device-secret auth, no JWT)
router.post('/data', verifyDeviceSecret, validate(iotDataSchema), receiveData);

// GET endpoints — Live Monitoring: accessible to both admin and control_room
router.get('/latest/:tankId',  authenticate, authorize('admin', 'control_room'), getLatestReading);
router.get('/history/:tankId', authenticate, authorize('admin', 'control_room'), getLiveHistory);

// All readings — paginated, filter by tank and date range
router.get('/readings', authenticate, authorize('admin', 'control_room'),
  validateRequest(readingsQuerySchema, 'query'), getReadings);

// Chart series — range=day|week|month|4months or custom from/to
router.get('/chart/:tankId', authenticate, authorize('admin', 'control_room'),
  validateRequest(Joi.object({ tankId: objectIdSchema.required() }), 'params'),
  validateRequest(chartQuerySchema, 'query'), getChartData);

module.exports = router;
