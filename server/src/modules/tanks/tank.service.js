const Tank = require('./tank.model');
const { AppError } = require('../../middleware/error.middleware');

const getAllTanks = async ({ page = 1, limit = 10, status } = {}) => {
  const query = {};
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const lim  = parseInt(limit);

  const [tanks, total] = await Promise.all([
    Tank.find(query).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    Tank.countDocuments(query),
  ]);

  return {
    tanks,
    pagination: {
      total,
      page:  parseInt(page),
      limit: lim,
      pages: Math.ceil(total / lim),
    },
  };
};

const getTankById = async (id) => {
  const tank = await Tank.findById(id).lean();
  if (!tank) throw new AppError('Tank not found', 404);
  return tank;
};

const getTankByDeviceId = async (deviceId) => {
  const tank = await Tank.findOne({ deviceId: deviceId.toUpperCase() }).lean();
  if (!tank) throw new AppError(`No tank found for device ID: ${deviceId}`, 404);
  return tank;
};

const createTank = async (data) => {
  const conflict = await Tank.findOne({
    $or: [
      { tankName: data.tankName },
      { deviceId: data.deviceId?.toUpperCase() },
    ],
  }).lean();

  if (conflict) {
    if (conflict.tankName === data.tankName) {
      throw new AppError('Tank name already exists', 409);
    }
    throw new AppError('Device ID is already assigned to another tank', 409);
  }

  return Tank.create({ ...data, deviceId: data.deviceId.toUpperCase() });
};

const updateTank = async (id, data) => {
  if (data.deviceId) data.deviceId = data.deviceId.toUpperCase();

  if (data.tankName || data.deviceId) {
    const orConditions = [];
    if (data.tankName) orConditions.push({ tankName: data.tankName });
    if (data.deviceId) orConditions.push({ deviceId: data.deviceId });

    const conflict = await Tank.findOne({ _id: { $ne: id }, $or: orConditions }).lean();

    if (conflict) {
      if (data.tankName && conflict.tankName === data.tankName) {
        throw new AppError('Tank name already exists', 409);
      }
      throw new AppError('Device ID is already assigned to another tank', 409);
    }
  }

  const tank = await Tank.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  }).lean();

  if (!tank) throw new AppError('Tank not found', 404);
  return tank;
};

const deleteTank = async (id) => {
  const tank = await Tank.findByIdAndDelete(id).lean();
  if (!tank) throw new AppError('Tank not found', 404);
  return tank;
};

// Called by the IoT service after each data ingestion
const updateTankOnline = async (deviceId, lastSeen) => {
  return Tank.findOneAndUpdate(
    { deviceId: deviceId.toUpperCase() },
    { status: 'online', lastSeen },
    { new: true }
  ).lean();
};

module.exports = {
  getAllTanks,
  getTankById,
  getTankByDeviceId,
  createTank,
  updateTank,
  deleteTank,
  updateTankOnline,
};
