const express = require('express');
const router = express.Router();
const { 
  generateBorrowingReport,
  getActivityLogs,
  getInventoryReport
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Reports accessible by Admin and Officer
router.post('/borrowings', authorize('admin', 'officer'), generateBorrowingReport);
router.get('/inventory', authorize('admin', 'officer'), getInventoryReport);

// Activity logs accessible by Admin only
router.get('/activity-logs', authorize('admin'), getActivityLogs);

module.exports = router;