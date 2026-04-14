import api from './axiosConfig';

export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),

  checkActivation: (data) => api.post('/auth/check-activation', data),

  activateAccount: (data) => api.post('/auth/activate', data),

  getCurrentUser: () => api.get('/auth/me'),

  updateTheme: (theme) => api.put('/auth/theme', { themePreference: theme }),
  
  updateProfile: (data) => api.put('/auth/profile', data),

  changePassword: (data) => api.put('/auth/password', data),

  logout: () => api.post('/auth/logout'),
};