const express = require('express');
const { receiveData, getLatestReading, getLiveHistory } = require('./iot.controller');
const { iotDataSchema, validate } = require('./iot.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { iotRateLimiter } = require('../../middleware/rateLimiter.middleware');
const { verifyDeviceSecret } = require('../../middleware/iot.middleware');

const router = express.Router();

// POST /api/iot/data — called by IoT devices (device-secret auth, no JWT)
router.post('/data', iotRateLimiter, verifyDeviceSecret, validate(iotDataSchema), receiveData);

// GET endpoints — Live Monitoring: accessible to both admin and control_room
router.get('/latest/:tankId',  authenticate, authorize('admin', 'control_room'), getLatestReading);
router.get('/history/:tankId', authenticate, authorize('admin', 'control_room'), getLiveHistory);

module.exports = router;
