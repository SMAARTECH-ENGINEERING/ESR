const tankService = require('./tank.service');
const { sendSuccess, sendPaginated } = require('../../utils/apiResponse.util');

const getAllTanks = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const result = await tankService.getAllTanks({ page, limit, status });
    return sendPaginated(res, result.tanks, result.pagination, 'Tanks retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getTankById = async (req, res, next) => {
  try {
    const tank = await tankService.getTankById(req.params.id);
    return sendSuccess(res, tank, 'Tank retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const createTank = async (req, res, next) => {
  try {
    const tank = await tankService.createTank(req.body);
    return sendSuccess(res, tank, 'Tank created successfully', 201);
  } catch (error) {
    next(error);
  }
};

const updateTank = async (req, res, next) => {
  try {
    const tank = await tankService.updateTank(req.params.id, req.body);
    return sendSuccess(res, tank, 'Tank updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteTank = async (req, res, next) => {
  try {
    await tankService.deleteTank(req.params.id);
    return sendSuccess(res, null, 'Tank deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllTanks, getTankById, createTank, updateTank, deleteTank };
