const Tank = require('../tanks/tank.model');
const LiveData = require('../iot/iot.model');
const { AppError } = require('../../middleware/error.middleware');

const getDashboardOverview = async () => {
  // Fetch all tanks and aggregate status counts in parallel
  const [tanks, statusAgg] = await Promise.all([
    Tank.find().sort({ tankName: 1 }).lean(),
    Tank.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  // Attach latest live reading to each tank
  const tanksWithData = await Promise.all(
    tanks.map(async (tank) => {
      const latest = await LiveData.findOne({ tankId: tank._id })
        .sort({ timestamp: -1 })
        .select('flowRate totalizer timestamp')
        .lean();

      return { ...tank, latestData: latest || null };
    })
  );

  // Build status summary
  const summary = { online: 0, offline: 0, inactive: 0 };
  statusAgg.forEach(({ _id, count }) => {
    if (_id in summary) summary[_id] = count;
  });

  return {
    summary: { totalTanks: tanks.length, ...summary },
    tanks: tanksWithData,
  };
};

const getTankDashboard = async (tankId) => {
  const tank = await Tank.findById(tankId).lean();
  if (!tank) throw new AppError('Tank not found', 404);

  const since = new Date(Date.now() - 60 * 60 * 1000); // last 60 minutes

  const [latestData, history] = await Promise.all([
    LiveData.findOne({ tankId }).sort({ timestamp: -1 }).lean(),
    LiveData.find({ tankId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .limit(60)
      .lean(),
  ]);

  return { tank, latestData, history };
};

module.exports = { getDashboardOverview, getTankDashboard };
