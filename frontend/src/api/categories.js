import api from './axiosConfig';

export const categoriesAPI = {
  getAllCategories: () => api.get('/categories'),
  
  createCategory: (categoryData) => api.post('/categories', categoryData),
  
  updateCategory: (id, categoryData) => api.put(`/categories/${id}`, categoryData),
  
  deleteCategory: (id) => api.delete(`/categories/${id}`),
};