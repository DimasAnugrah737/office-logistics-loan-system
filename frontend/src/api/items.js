import api from './axiosConfig';

export const itemsAPI = {
  getAllItems: (params) => api.get('/items', { params }),
  
  getItemById: (id) => api.get(`/items/${id}`),
  
  createItem: (itemData) => api.post('/items', itemData),
  
  updateItem: (id, itemData) => api.put(`/items/${id}`, itemData),
  
  deleteItem: (id) => api.delete(`/items/${id}`),
};