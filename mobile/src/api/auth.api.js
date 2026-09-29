import apiClient from './client';

// Maps 1:1 to server/src/modules/auth/auth.route.js
export const login = (email, password) =>
  apiClient.post('/auth/login', { email, password });

export const register = (name, email, password, role) =>
  apiClient.post('/auth/register', { name, email, password, role });

export const getProfile = () => apiClient.get('/auth/profile');
