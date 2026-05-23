const dashboardService = require('./dashboard.service');
const { sendSuccess } = require('../../utils/apiResponse.util');

const getDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getDashboardOverview();
    return sendSuccess(res, data, 'Dashboard data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getTankDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getTankDashboard(req.params.tankId);
    return sendSuccess(res, data, 'Tank dashboard retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard, getTankDashboard };
