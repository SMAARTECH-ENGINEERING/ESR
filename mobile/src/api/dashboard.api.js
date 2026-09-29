import apiClient from './client';

// Maps 1:1 to server/src/modules/dashboard/dashboard.route.js
export const getDashboardOverview = () => apiClient.get('/dashboard');

export const getDashboardTank = (tankId) => apiClient.get(`/dashboard/${tankId}`);
