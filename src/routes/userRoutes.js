const express = require('express');
const router = express.Router();
const {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetPassword
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Public routes for authenticated users (Admin and Officer can see list)
router.route('/')
  .get(authorize('admin', 'officer'), getUsers);

// Admin and Officer routes
router.use(authorize('admin', 'officer'));

// Admin strictly for password reset
router.put('/:id/reset-password', authorize('admin'), resetPassword);

router.route('/')
  .post(createUser);

router.route('/:id')
  .get(getUserById)
  .put(updateUser)
  .delete(deleteUser);

module.exports = router;