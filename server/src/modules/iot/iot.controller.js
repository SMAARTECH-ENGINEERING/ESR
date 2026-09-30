const iotService = require('./iot.service');
const { sendSuccess, sendPaginated } = require('../../utils/apiResponse.util');

const receiveData = async (req, res, next) => {
  try {
    const result = await iotService.processIoTData(req.body);
    return sendSuccess(res, {
      tankId:     result.tank._id,
      tankName:   result.tank.tankName,
      receivedAt: new Date().toISOString(),
    }, 'Data received successfully');
  } catch (error) {
    next(error);
  }
};

const getLatestReading = async (req, res, next) => {
  try {
    const data = await iotService.getLatestReading(req.params.tankId);
    return sendSuccess(res, data, 'Latest reading retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getLiveHistory = async (req, res, next) => {
  try {
    const { tankId } = req.params;
    const { hours = 1, limit = 60 } = req.query;
    const data = await iotService.getLiveHistory(tankId, { hours, limit });
    return sendSuccess(res, data, 'Live history retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getReadings = async (req, res, next) => {
  try {
    const { readings, pagination } = await iotService.getReadings(req.query);
    return sendPaginated(res, readings, pagination, 'Readings retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const getChartData = async (req, res, next) => {
  try {
    const data = await iotService.getChartData(req.params.tankId, req.query);
    return sendSuccess(res, data, 'Chart data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { receiveData, getLatestReading, getLiveHistory, getReadings, getChartData };
