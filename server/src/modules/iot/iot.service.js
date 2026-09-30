const mongoose = require('mongoose');
const Tank = require('../tanks/tank.model');
const { getRetentionDays } = require('../../config/retention');
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

  // Persist live reading (kept DATA_RETENTION_DAYS via TTL index)
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

// ─── Readings browser + charts ────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_PRESET_DAYS = { day: 1, week: 7, month: 30, '4months': 120 };

// Bucket size keeps every chart at roughly 250–500 points
const pickBucketMinutes = (spanMs) => {
  const hours = spanMs / 3600000;
  if (hours <= 24) return 5;
  if (hours <= 24 * 7) return 30;
  if (hours <= 24 * 31) return 120;
  return 360;
};

const resolveRange = ({ range = 'day', from, to }) => {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - RANGE_PRESET_DAYS[range] * DAY_MS);
  if (start >= end) throw new AppError('"from" must be before "to"', 400);
  if (end - start > (getRetentionDays() + 1) * DAY_MS) {
    throw new AppError(`Date range cannot exceed ${getRetentionDays()} days`, 400);
  }
  return { start, end };
};

const serverTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const isValidTimeZone = (tz) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

// Paginated raw readings, newest first, optional tank + date filter
const getReadings = async ({ tankId, from, to, page = 1, limit = 50 }) => {
  const query = {};
  if (tankId) query.tankId = new mongoose.Types.ObjectId(tankId);
  if (from || to) {
    query.timestamp = {};
    if (from) query.timestamp.$gte = new Date(from);
    if (to)   query.timestamp.$lte = new Date(to);
  }

  const [rows, total] = await Promise.all([
    LiveData.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('tankId deviceId flowRate totalizer waterLevelPercent timestamp')
      .lean(),
    LiveData.countDocuments(query),
  ]);

  const tankIds = [...new Set(rows.map((r) => String(r.tankId)))];
  const tanks = await Tank.find({ _id: { $in: tankIds } }).select('tankName').lean();
  const names = new Map(tanks.map((t) => [String(t._id), t.tankName]));

  return {
    readings: rows.map((r) => ({ ...r, tankName: names.get(String(r.tankId)) || '(deleted tank)' })),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
};

// Time-bucketed chart series for one tank
const getChartData = async (tankId, { range, from, to, tz } = {}) => {
  const { start, end } = resolveRange({ range, from, to });
  const bucketMinutes = pickBucketMinutes(end - start);
  const timezone = tz && isValidTimeZone(tz) ? tz : serverTimeZone();

  const points = await LiveData.aggregate([
    { $match: { tankId: new mongoose.Types.ObjectId(tankId), timestamp: { $gte: start, $lte: end } } },
    { $sort: { timestamp: 1 } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$timestamp', unit: 'minute', binSize: bucketMinutes, timezone } },
        flowAvg:   { $avg: '$flowRate' },
        flowMax:   { $max: '$flowRate' },
        totalizer: { $last: '$totalizer' },
        level:     { $avg: '$waterLevelPercent' },
        count:     { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        t: '$_id',
        flowAvg: { $round: ['$flowAvg', 2] },
        flowMax: { $round: ['$flowMax', 2] },
        totalizer: { $round: ['$totalizer', 2] },
        level: { $round: ['$level', 1] },
        count: 1,
      },
    },
  ]);

  return { from: start, to: end, bucketMinutes, timezone, points };
};

module.exports = {
  processIoTData,
  getLatestReading,
  getLiveHistory,
  getReadings,
  getChartData,
  resolveRange,
  pickBucketMinutes,
};
