import api from './axiosConfig';

export const borrowingsAPI = {
  getAllBorrowings: (params) => api.get('/borrowings', { params }),

  getBorrowingById: (id) => api.get(`/borrowings/${id}`),

  createBorrowing: (borrowingData) => api.post('/borrowings', borrowingData),

  approveBorrowing: (id, notes) => api.put(`/borrowings/${id}/approve`, { notes }),

  rejectBorrowing: (id, reason) => api.put(`/borrowings/${id}/reject`, { reason }),

  markAsBorrowed: (id, conditionBefore, notes) =>
    api.put(`/borrowings/${id}/borrow`, { conditionBefore, notes }),

  requestReturn: (id, conditionAfter, notes) =>
    api.put(`/borrowings/${id}/return-request`, { conditionAfter, notes }),

  approveReturn: (id, conditionAfter, notes, penalty, penaltyStatus) =>
    api.put(`/borrowings/${id}/approve-return`, { conditionAfter, notes, penalty, penaltyStatus }),

  updatePenaltyStatus: (id, penaltyStatus, penalty) =>
    api.put(`/borrowings/${id}/penalty`, { penaltyStatus, penalty }),

  getDashboardStats: () => api.get('/borrowings/stats/dashboard'),

  getUserBorrowingHistory: () => api.get('/borrowings/user/history'),
  cancelBorrowing: (id) => api.put(`/borrowings/${id}/cancel`),
  deleteBorrowing: (id) => api.delete(`/borrowings/${id}`),
};