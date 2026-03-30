// authController.js - PERBAIKAN
const User = require('../models/User'); // ✅ Dari controllers ke models
const jwt = require('jsonwebtoken');
const ActivityLog = require('../models/ActivityLog'); // ✅ Path yang sama
const { Op } = require('sequelize');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Check if identifier is email or NIP
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { nip: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        message: 'NIP/Email tidak terdaftar',
        field: 'identifier'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Akun dinonaktifkan. Hubungi Admin.' });
    }

    // New: Check if activated (Admins can skip if they have password set)
    if (!user.isActivated && user.role !== 'admin') {
      return res.status(401).json({ message: 'Akun belum diaktivasi. Silakan aktivasi akun terlebih dahulu.' });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Password salah',
        field: 'password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log activity
    await ActivityLog.create({
      userId: user.id,
      action: 'User login',
      entityType: 'user',
      details: { loginMethod: 'nip/password' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      id: user.id,
      _id: user.id,
      fullName: user.fullName,
      nip: user.nip,
      email: user.email,
      role: user.role,
      department: user.department,
      position: user.position,
      themePreference: user.themePreference,
      isBlockedFromBorrowing: user.isBlockedFromBorrowing,
      token: generateToken(user.id)
    });
  } catch (error) {
    console.error('Login error:', error);
    try {
      const fs = require('fs');
      fs.appendFileSync('error.log', `${new Date().toISOString()} - LOGIN ERROR: ${error.message}\n${error.stack}\n\n`);
    } catch (logErr) {
      console.error('Failed to log login error:', logErr);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Check NIP for activation
// @route   POST /api/auth/check-activation
// @access  Public
const checkActivation = async (req, res) => {
  try {
    const { nip } = req.body;
    const user = await User.findOne({ where: { nip } });

    if (!user) {
      return res.status(404).json({ message: 'NIP tidak ditemukan. Pastikan NIP sudah didaftarkan oleh Administrator.' });
    }

    if (user.isActivated) {
      return res.status(400).json({ 
        message: 'Akun dengan NIP ini sudah diaktivasi. Silakan langsung login.',
        alreadyActivated: true 
      });
    }

    res.json({ success: true, nip: user.nip, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Activate account
// @route   POST /api/auth/activate
// @access  Public
const activateAccount = async (req, res) => {
  try {
    const { nip, fullName, email, password, department, position, phone } = req.body;

    const user = await User.findOne({ where: { nip } });

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    if (user.isActivated) {
      return res.status(400).json({ message: 'Akun sudah aktif' });
    }

    // Update user details
    await user.update({
      fullName,
      email,
      password, // bcrypt hook will handle hashing
      department,
      position,
      phone,
      isActivated: true,
      isActive: true
    });

    await ActivityLog.create({
      userId: user.id,
      action: 'Account self-activated',
      entityType: 'user',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      message: 'Aktivasi berhasil! Selamat bergabung. Silakan login menggunakan NIP Anda.',
      success: true
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Email sudah digunakan oleh akun lain.' });
    }
    console.error('Activation error:', error);
    res.status(500).json({ message: 'Gagal aktivasi: ' + error.message });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update theme preference
// @route   PUT /api/auth/theme
// @access  Private
const updateTheme = async (req, res) => {
  try {
    const { themePreference } = req.body;

    if (!['light', 'dark'].includes(themePreference)) {
      return res.status(400).json({ message: 'Invalid theme preference' });
    }

    await User.update(
      { themePreference },
      { where: { id: req.user.id } }
    );

    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    res.json(user);
  } catch (error) {
    console.error('Update theme error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, department, position, phone } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    await user.update({
      fullName,
      email,
      department,
      position,
      phone
    });

    const updatedUser = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    res.json(updatedUser);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Email sudah digunakan oleh akun lain.' });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Password saat ini salah' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password berhasil diperbarui' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: 'User logout',
      entityType: 'user',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  login,
  getMe,
  updateTheme,
  logout,
  checkActivation,
  activateAccount,
  updateProfile,
  changePassword
};