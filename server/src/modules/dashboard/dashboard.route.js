const express = require('express');
const { getDashboard, getTankDashboard } = require('./dashboard.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');

const router = express.Router();

// All dashboard routes require authentication
router.use(authenticate);

// Live Monitoring — accessible to both admin and control_room
router.get('/',        authorize('admin', 'control_room'), getDashboard);
router.get('/:tankId', authorize('admin', 'control_room'), getTankDashboard);

module.exports = router;
