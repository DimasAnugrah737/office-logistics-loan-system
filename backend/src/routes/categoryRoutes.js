const express = require('express');
const router = express.Router();
const { 
  createCategory, 
  getCategories, 
  updateCategory, 
  deleteCategory 
} = require('../controllers/categoryController');
const { protect, authorize } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Public routes for all authenticated users
router.route('/')
  .get(getCategories);

// Admin only routes
router.use(authorize('admin'));

router.route('/')
  .post(createCategory);

router.route('/:id')
  .put(updateCategory)
  .delete(deleteCategory);

module.exports = router;