const express = require('express');
const { getDailyReport, getWeeklyReport, getMonthlyReport } = require('./report.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');

const router = express.Router();

// All report routes require authentication
router.use(authenticate);

// Reports — accessible to both admin and control_room
router.get('/daily/:tankId',   authorize('admin', 'control_room'), getDailyReport);
router.get('/weekly/:tankId',  authorize('admin', 'control_room'), getWeeklyReport);
router.get('/monthly/:tankId', authorize('admin', 'control_room'), getMonthlyReport);

module.exports = router;
