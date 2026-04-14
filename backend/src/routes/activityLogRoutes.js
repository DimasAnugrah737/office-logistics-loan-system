const express = require('express');
const router = express.Router();
const { 
  getActivityLogs,
  cleanupLogs
} = require('../controllers/activityLogController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

router.get('/', getActivityLogs);
router.delete('/cleanup', cleanupLogs);

module.exports = router;