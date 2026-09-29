import apiClient from './client';

// Maps 1:1 to server/src/modules/reports/report.route.js
export const getDailyReport = (tankId, date) =>
  apiClient.get(`/reports/daily/${tankId}`, { params: date ? { date } : {} });

export const getWeeklyReport = (tankId, startDate) =>
  apiClient.get(`/reports/weekly/${tankId}`, { params: startDate ? { startDate } : {} });

export const getMonthlyReport = (tankId, year, month) =>
  apiClient.get(`/reports/monthly/${tankId}`, { params: { year, month } });
