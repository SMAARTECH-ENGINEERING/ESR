import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/env';

let socket = null;

// Single shared Socket.IO connection, mirroring the web client's usage
// (config/socket.js server-side; TankDetail.jsx client-side).
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ['websocket'], autoConnect: false });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}
