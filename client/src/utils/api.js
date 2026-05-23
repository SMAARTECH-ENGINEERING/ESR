import axios from 'axios';
import { decryptData } from '../Screens/localStorageUtils';

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api`,
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const data = decryptData();
    if (data?.token) {
      config.headers.Authorization = `Bearer ${data.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
