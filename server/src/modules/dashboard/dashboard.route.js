const express = require('express');
const { getDashboard, getTankDashboard } = require('./dashboard.controller');
const { authenticate } = require('../../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

router.get('/',           getDashboard);
router.get('/:tankId',    getTankDashboard);

module.exports = router;
