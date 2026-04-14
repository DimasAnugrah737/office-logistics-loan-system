const express = require('express');
const router = express.Router();
const {
  createBorrowing,
  getBorrowings,
  getBorrowingById,
  approveBorrowing,
  rejectBorrowing,
  markAsBorrowed,
  requestReturn,
  approveReturn,
  getDashboardStats,
  getUserBorrowingHistory,
  cancelBorrowing,
  updatePenaltyStatus,
  deleteBorrowing
} = require('../controllers/borrowingController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Specific routes first (before /:id)
router.get('/stats/dashboard', getDashboardStats);
router.get('/user/history', getUserBorrowingHistory);

// User routes
router.post('/', createBorrowing);

// Admin/Officer routes
router.get('/', getBorrowings);
router.get('/:id', getBorrowingById);

// Approval routes (Officer/Admin)
router.put('/:id/approve', authorize('officer', 'admin'), approveBorrowing);
router.put('/:id/reject', authorize('officer', 'admin'), rejectBorrowing);
router.put('/:id/borrow', authorize('officer', 'admin'), markAsBorrowed);

// Return routes
router.put('/:id/return-request', requestReturn);
router.put('/:id/approve-return', authorize('officer', 'admin'), approveReturn);
router.put('/:id/cancel', cancelBorrowing);
router.put('/:id/penalty', authorize('officer', 'admin'), updatePenaltyStatus);
router.delete('/:id', authorize('admin'), deleteBorrowing);

module.exports = router;