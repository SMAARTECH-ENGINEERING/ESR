const Tank = require('../tanks/tank.model');
const LiveData = require('./iot.model');
const { emitTankUpdate, emitTankStatusChange } = require('../../config/socket');
const { AppError } = require('../../middleware/error.middleware');
const logger = require('../../config/logger');

const processIoTData = async ({ deviceId, flowRate, totalizer, waterLevelPercent, timestamp }) => {
  const tank = await Tank.findOne({ deviceId: deviceId.toUpperCase() });
  if (!tank) {
    throw new AppError(`No tank registered for device ID: ${deviceId}`, 404);
  }

  const dataTimestamp = timestamp ? new Date(timestamp) : new Date();

  // Persist live reading (TTL 24h handled by MongoDB)
  await LiveData.create({
    tankId:    tank._id,
    deviceId:  deviceId.toUpperCase(),
    flowRate,
    totalizer,
    waterLevelPercent,
    timestamp: dataTimestamp,
  });

  // Update tank status and last-seen
  const wasOffline = tank.status !== 'online';
  const updatedTank = await Tank.findByIdAndUpdate(
    tank._id,
    { status: 'online', lastSeen: dataTimestamp },
    { new: true }
  ).lean();

  // Emit realtime payload to subscribed clients
  const payload = {
    tankId:    tank._id.toString(),
    tankName:  updatedTank.tankName,
    deviceId:  deviceId.toUpperCase(),
    location:  updatedTank.location,
    flowRate,
    totalizer,
    waterLevelPercent,
    status:    'online',
    lastSeen:  dataTimestamp,
    timestamp: dataTimestamp,
  };

  emitTankUpdate(tank._id.toString(), payload);

  // Emit status change event if the tank was previously offline/inactive
  if (wasOffline) {
    emitTankStatusChange(tank._id.toString(), 'online', updatedTank.tankName);
  }

  logger.info(`IoT [${deviceId}] flowRate=${flowRate} totalizer=${totalizer} waterLevelPercent=${waterLevelPercent}`);

  return { tank: updatedTank };
};

const getLatestReading = async (tankId) => {
  return LiveData.findOne({ tankId }).sort({ timestamp: -1 }).lean();
};

// Fetch up to `limit` readings from the last `hours` hours
const getLiveHistory = async (tankId, { hours = 1, limit = 60 } = {}) => {
  const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);
  return LiveData.find({ tankId, timestamp: { $gte: since } })
    .sort({ timestamp: -1 })
    .limit(Number(limit))
    .lean();
};

module.exports = { processIoTData, getLatestReading, getLiveHistory };
