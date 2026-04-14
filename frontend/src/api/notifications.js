import api from './axiosConfig';

export const notificationsAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  
  getUnreadCount: () => api.get('/notifications/unread-count'),
  
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  
  markAllAsRead: () => api.put('/notifications/mark-all-read'),
  
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  
  deleteAllNotifications: () => api.delete('/notifications/all'),
};