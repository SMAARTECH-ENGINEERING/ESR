const reportService = require('./report.service');
const { sendSuccess } = require('../../utils/apiResponse.util');

const getDailyReport = async (req, res, next) => {
  try {
    const { tankId } = req.params;
    const { date } = req.query;
    const report = await reportService.getDailyReport(tankId, date);
    return sendSuccess(res, report, 'Daily report retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getWeeklyReport = async (req, res, next) => {
  try {
    const { tankId } = req.params;
    const { startDate } = req.query;
    const report = await reportService.getWeeklyReport(tankId, startDate);
    return sendSuccess(res, report, 'Weekly report retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getMonthlyReport = async (req, res, next) => {
  try {
    const { tankId } = req.params;
    const { year, month } = req.query;
    const report = await reportService.getMonthlyReport(tankId, year, month);
    return sendSuccess(res, report, 'Monthly report retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { getDailyReport, getWeeklyReport, getMonthlyReport };
