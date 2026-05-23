const { getIO } = require('../config/socket');
const logger = require('../config/logger');

// Broadcast a live IoT data update to all clients in a tank room and the dashboard
const broadcastTankData = (tankId, data) => {
  try {
    const io = getIO();
    io.to(`tank:${tankId}`).emit('tank:data', data);
    io.to('dashboard').emit('tank:data', data);
  } catch (err) {
    logger.error('broadcastTankData error:', err);
  }
};

// Broadcast a system-wide alert to all connected clients
const broadcastSystemAlert = (message, type = 'info') => {
  try {
    const io = getIO();
    io.emit('system:alert', { message, type, timestamp: new Date() });
  } catch (err) {
    logger.error('broadcastSystemAlert error:', err);
  }
};

// Get number of currently connected Socket.IO clients
const getConnectedClientsCount = () => {
  try {
    return getIO().engine.clientsCount;
  } catch {
    return 0;
  }
};

module.exports = {
  broadcastTankData,
  broadcastSystemAlert,
  getConnectedClientsCount,
};
