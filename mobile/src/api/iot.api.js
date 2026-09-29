import apiClient from './client';

// Maps 1:1 to server/src/modules/iot/iot.route.js (device-ingest POST /data
// excluded — that endpoint is for physical devices, not this app)
export const getLatestReading = (tankId) => apiClient.get(`/iot/latest/${tankId}`);

export const getReadingHistory = (tankId, hours, limit) =>
  apiClient.get(`/iot/history/${tankId}`, { params: { hours, limit } });
