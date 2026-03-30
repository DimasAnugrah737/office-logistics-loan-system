import api from './axiosConfig';

export const reportsAPI = {
  generateBorrowingReport: (data) => {
    const isFile = data.format === 'excel' || data.format === 'pdf';
    return api.post('/reports/borrowings', data, isFile ? { responseType: 'blob' } : {});
  },

  getInventoryReport: (params = {}) => {
    const isFile = params.format === 'excel' || params.format === 'pdf';
    return api.get('/reports/inventory', {
      params,
      ...(isFile ? { responseType: 'blob' } : {})
    });
  },

  getActivityLogs: (params) => api.get('/reports/activity-logs', { params }),

  cleanupActivityLogs: (type = 'trash') => api.delete(`/activity-logs/cleanup?type=${type}`),
};