import axios from "axios";
import { decryptData } from "../Screens/localStorageUtils";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_API_URL}/api`,
  timeout: 15000,
});

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const data = decryptData();

    if (data?.token) {
      config.headers.Authorization = `Bearer ${data.token}`;
      console.log("✓ Token added to request");
    } else {
      console.warn("⚠ No token found in storage");
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor
api.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      console.error("❌ 401 Unauthorized - Token invalid or expired");
      localStorage.clear();
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

export default api;