const express = require('express');
const { getDailyReport, getWeeklyReport, getMonthlyReport } = require('./report.controller');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/daily/:tankId',   getDailyReport);
router.get('/weekly/:tankId',  getWeeklyReport);
router.get('/monthly/:tankId', getMonthlyReport);

module.exports = router;
