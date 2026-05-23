const { Server } = require('socket.io');
const logger = require('./logger');

let io = null;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Subscribe to a specific tank's realtime feed
    socket.on('subscribe:tank', (tankId) => {
      socket.join(`tank:${tankId}`);
      logger.info(`Socket ${socket.id} subscribed → tank:${tankId}`);
    });

    // Unsubscribe from a tank
    socket.on('unsubscribe:tank', (tankId) => {
      socket.leave(`tank:${tankId}`);
      logger.info(`Socket ${socket.id} unsubscribed → tank:${tankId}`);
    });

    // Subscribe to the global dashboard feed
    socket.on('subscribe:dashboard', () => {
      socket.join('dashboard');
      logger.info(`Socket ${socket.id} subscribed → dashboard`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} — ${reason}`);
    });
  });

  logger.info('Socket.IO initialized');
  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  return io;
};

// Emit live IoT data to tank room and dashboard room
const emitTankUpdate = (tankId, data) => {
  if (!io) return;
  io.to(`tank:${tankId}`).emit('tank:data', data);
  io.to('dashboard').emit('tank:data', data);
};

// Emit status change (online / offline) to tank room and dashboard room
const emitTankStatusChange = (tankId, status, tankName) => {
  if (!io) return;
  const payload = { tankId, tankName, status, timestamp: new Date() };
  io.to(`tank:${tankId}`).emit('tank:status', payload);
  io.to('dashboard').emit('tank:status', payload);
};

module.exports = {
  initializeSocket,
  getIO,
  emitTankUpdate,
  emitTankStatusChange,
};
