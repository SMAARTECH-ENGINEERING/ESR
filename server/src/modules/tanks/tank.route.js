const express = require('express');
const { getAllTanks, getTankById, createTank, updateTank, deleteTank } = require('./tank.controller');
const { createTankSchema, updateTankSchema, validate } = require('./tank.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');

const router = express.Router();

// All tank routes require authentication
router.use(authenticate);

// Only admin can view, create, update, or delete tanks
// control_room accesses tank data indirectly via /api/dashboard
router.get('/',       authorize('admin'), getAllTanks);
router.get('/:id',    authorize('admin'), getTankById);
router.post('/',      authorize('admin'), validate(createTankSchema), createTank);
router.put('/:id',    authorize('admin'), validate(updateTankSchema), updateTank);
router.delete('/:id', authorize('admin'),                             deleteTank);

module.exports = router;
