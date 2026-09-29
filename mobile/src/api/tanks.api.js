import apiClient from './client';

// Maps 1:1 to server/src/modules/tanks/tank.route.js (admin only)
export const getTanks = (params) => apiClient.get('/tanks', { params });

export const getTankById = (id) => apiClient.get(`/tanks/${id}`);

export const createTank = (payload) => apiClient.post('/tanks', payload);

export const updateTank = (id, payload) => apiClient.put(`/tanks/${id}`, payload);

export const deleteTank = (id) => apiClient.delete(`/tanks/${id}`);
