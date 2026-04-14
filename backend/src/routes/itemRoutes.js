const express = require('express');
const router = express.Router();
const {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem
} = require('../controllers/itemController');

const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/uploadMiddleware');

router.use(protect);

// Public routes (authenticated users)
router.route('/')
  .get(authorize('admin', 'officer', 'user'), getItems)
  .post(authorize('admin', 'officer'), upload.single('image'), createItem);

router.route('/:id')
  .get(authorize('admin', 'officer', 'user'), getItemById)
  .put(authorize('admin', 'officer'), upload.single('image'), updateItem)
  .delete(authorize('admin', 'officer'), deleteItem);

module.exports = router;