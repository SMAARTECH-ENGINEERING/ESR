import axios from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from '../config/env';
import { getToken } from '../utils/storage';
import { emitUnauthorized } from '../utils/authEvents';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message ||
      (error.code === 'ECONNABORTED'
        ? 'Request timed out. Please check your connection.'
        : 'Network error. Please try again.');

    if (status === 401) {
      emitUnauthorized();
    }

    return Promise.reject({ status, message, errors: error.response?.data?.errors });
  }
);

export default apiClient;
