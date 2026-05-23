const mongoose = require('mongoose');
const ReportData = require('./report.model');
const Tank = require('../tanks/tank.model');
const LiveData = require('../iot/iot.model');
const { AppError } = require('../../middleware/error.middleware');
const logger = require('../../config/logger');

// ─── helpers ──────────────────────────────────────────────────────────────────

const toObjId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid tank ID: ${id}`, 400);
  }
  return new mongoose.Types.ObjectId(id);
};

const validateTank = async (tankId) => {
  const tank = await Tank.findById(tankId).lean();
  if (!tank) throw new AppError('Tank not found', 404);
  return tank;
};

// Returns the Monday of the current week
const startOfCurrentWeek = () => {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── 30-minute snapshot (called by cron job) ──────────────────────────────────

const saveReportSnapshot = async () => {
  try {
    const tanks = await Tank.find({ status: 'online' }).lean();
    const snapshots = [];

    for (const tank of tanks) {
      const latest = await LiveData.findOne({ tankId: tank._id })
        .sort({ timestamp: -1 })
        .lean();

      if (latest) {
        snapshots.push({
          tankId:       tank._id,
          deviceId:     tank.deviceId,
          flowRate:     latest.flowRate,
          totalizer:    latest.totalizer,
          intervalTime: new Date(),
          createdAt:    new Date(),
        });
      }
    }

    if (snapshots.length > 0) {
      await ReportData.insertMany(snapshots, { ordered: false });
      logger.info(`Report snapshot saved for ${snapshots.length} tank(s)`);
    }
  } catch (error) {
    logger.error('saveReportSnapshot failed:', error);
  }
};

// ─── Daily Report ─────────────────────────────────────────────────────────────
// Daily total = latest totalizer value of the day (totalizer resets at midnight)

const getDailyReport = async (tankId, date) => {
  await validateTank(tankId);

  const refDate = date ? new Date(date) : new Date();
  const dayStart = new Date(refDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(refDate);
  dayEnd.setHours(23, 59, 59, 999);

  const result = await ReportData.aggregate([
    {
      $match: {
        tankId:       toObjId(tankId),
        intervalTime: { $gte: dayStart, $lte: dayEnd },
      },
    },
    // Sort ascending so $last accumulator picks the latest reading
    { $sort: { intervalTime: 1 } },
    {
      $group: {
        _id:             null,
        dailyTotal:      { $last: '$totalizer' },  // latest totalizer = day total
        avgFlowRate:     { $avg: '$flowRate' },
        maxFlowRate:     { $max: '$flowRate' },
        minFlowRate:     { $min: '$flowRate' },
        totalReadings:   { $sum: 1 },
        firstReadingAt:  { $first: '$intervalTime' },
        lastReadingAt:   { $last: '$intervalTime' },
      },
    },
    {
      $project: {
        _id:            0,
        dailyTotal:     1,
        avgFlowRate:    { $round: ['$avgFlowRate', 2] },
        maxFlowRate:    1,
        minFlowRate:    1,
        totalReadings:  1,
        firstReadingAt: 1,
        lastReadingAt:  1,
      },
    },
  ]);

  return {
    tankId,
    date:   dayStart.toISOString().split('T')[0],
    report: result[0] || null,
  };
};

// ─── Weekly Report ────────────────────────────────────────────────────────────
// weeklyTotal = sum of each day's latest totalizer within the week

const getWeeklyReport = async (tankId, startDate) => {
  await validateTank(tankId);

  const weekStart = startDate ? new Date(startDate) : startOfCurrentWeek();
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const dailyRows = await ReportData.aggregate([
    {
      $match: {
        tankId:       toObjId(tankId),
        intervalTime: { $gte: weekStart, $lte: weekEnd },
      },
    },
    { $sort: { intervalTime: 1 } },
    {
      $group: {
        _id: {
          year:  { $year:  '$intervalTime' },
          month: { $month: '$intervalTime' },
          day:   { $dayOfMonth: '$intervalTime' },
        },
        dailyTotal:    { $last: '$totalizer' },
        avgFlowRate:   { $avg: '$flowRate' },
        maxFlowRate:   { $max: '$flowRate' },
        totalReadings: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: {
              $dateFromParts: {
                year: '$_id.year', month: '$_id.month', day: '$_id.day',
              },
            },
          },
        },
        dailyTotal:    1,
        avgFlowRate:   { $round: ['$avgFlowRate', 2] },
        maxFlowRate:   1,
        totalReadings: 1,
      },
    },
  ]);

  const weeklyTotal = dailyRows.reduce((sum, r) => sum + (r.dailyTotal || 0), 0);

  return {
    tankId,
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd:   weekEnd.toISOString().split('T')[0],
    weeklyTotal,
    dailyBreakdown: dailyRows,
  };
};

// ─── Monthly Report ───────────────────────────────────────────────────────────
// monthlyTotal = sum of each day's latest totalizer within the month

const getMonthlyReport = async (tankId, year, month) => {
  await validateTank(tankId);

  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;

  const monthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const monthEnd   = new Date(y, m,     0, 23, 59, 59, 999);

  const dailyRows = await ReportData.aggregate([
    {
      $match: {
        tankId:       toObjId(tankId),
        intervalTime: { $gte: monthStart, $lte: monthEnd },
      },
    },
    { $sort: { intervalTime: 1 } },
    {
      $group: {
        _id: {
          year:  { $year:  '$intervalTime' },
          month: { $month: '$intervalTime' },
          day:   { $dayOfMonth: '$intervalTime' },
        },
        dailyTotal:    { $last: '$totalizer' },
        avgFlowRate:   { $avg: '$flowRate' },
        maxFlowRate:   { $max: '$flowRate' },
        totalReadings: { $sum: 1 },
      },
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
    },
    {
      $project: {
        _id: 0,
        date: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: {
              $dateFromParts: {
                year: '$_id.year', month: '$_id.month', day: '$_id.day',
              },
            },
          },
        },
        dailyTotal:    1,
        avgFlowRate:   { $round: ['$avgFlowRate', 2] },
        maxFlowRate:   1,
        totalReadings: 1,
      },
    },
  ]);

  const monthlyTotal = dailyRows.reduce((sum, r) => sum + (r.dailyTotal || 0), 0);

  return {
    tankId,
    year: y,
    month: m,
    monthlyTotal,
    dailyBreakdown: dailyRows,
  };
};

module.exports = {
  saveReportSnapshot,
  getDailyReport,
  getWeeklyReport,
  getMonthlyReport,
};
