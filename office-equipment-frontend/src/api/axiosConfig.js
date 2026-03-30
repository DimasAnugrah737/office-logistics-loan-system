import axios from 'axios';

const isProduction = import.meta.env.MODE === 'production';
const API_URL = isProduction ? '/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      // Clear storage and redirect to login only if NOT a login attempt
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    const message = error.response?.data?.message || error.message || 'An error occurred';
    const errorData = {
      message,
      field: error.response?.data?.field,
      errors: error.response?.data?.errors,
      alreadyActivated: error.response?.data?.alreadyActivated
    };
    return Promise.reject(errorData);
  }
);

export default api;