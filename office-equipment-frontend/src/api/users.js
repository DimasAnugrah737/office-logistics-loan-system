import api from './axiosConfig';

export const usersAPI = {
  getAllUsers: () => api.get('/users'),
  
  getUserById: (id) => api.get(`/users/${id}`),
  
  createUser: (userData) => api.post('/users', userData),
  
  updateUser: (id, userData) => api.put(`/users/${id}`, userData),
  
  deleteUser: (id) => api.delete(`/users/${id}`),

  resetPassword: (id) => api.put(`/users/${id}/reset-password`),
};