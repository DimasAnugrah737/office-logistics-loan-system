const express = require('express');
const router = express.Router();
const { 
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  deleteAllNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Registration order: Static routes BEFORE Dynamic routes
router.get('/unread-count', getUnreadCount);
router.put('/mark-all-read', markAllAsRead);
router.delete('/all', deleteAllNotifications); // Moved up explicitly near static routes

// General list routes
router.get('/', getNotifications);

// Dynamic routes with parameters AFTER static ones
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;