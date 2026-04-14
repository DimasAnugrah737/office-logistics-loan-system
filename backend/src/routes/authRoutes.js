const express = require('express');
const router = express.Router();
const { 
  login, 
  getMe, 
  updateTheme, 
  logout, 
  checkActivation, 
  activateAccount,
  updateProfile,
  changePassword 
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/check-activation', checkActivation);
router.post('/activate', activateAccount);
router.get('/me', protect, getMe);
router.put('/theme', protect, updateTheme);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);
router.post('/logout', protect, logout);

module.exports = router;