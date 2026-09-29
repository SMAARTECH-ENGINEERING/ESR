const express = require('express');
const { getStatus, retryFailed, runNow } = require('./iwcrcm.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');

const router = express.Router();

// IWCRCM integration monitoring — admin only
router.use(authenticate, authorize('admin'));

router.get('/status',        getStatus);
router.post('/retry-failed', retryFailed);
router.post('/run',          runNow);

module.exports = router;
