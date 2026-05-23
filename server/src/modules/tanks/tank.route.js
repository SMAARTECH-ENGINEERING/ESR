const express = require('express');
const { getAllTanks, getTankById, createTank, updateTank, deleteTank } = require('./tank.controller');
const { createTankSchema, updateTankSchema, validate } = require('./tank.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');

const router = express.Router();

// All tank routes require authentication
router.use(authenticate);

// Both admin and control_room can view tanks
router.get('/',    getAllTanks);
router.get('/:id', getTankById);

// Only admin can create, update, delete
router.post('/',    authorize('admin'), validate(createTankSchema), createTank);
router.put('/:id',  authorize('admin'), validate(updateTankSchema), updateTank);
router.delete('/:id', authorize('admin'),                           deleteTank);

module.exports = router;
