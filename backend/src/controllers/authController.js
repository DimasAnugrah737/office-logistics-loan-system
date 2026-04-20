/**
 * Controller untuk menangani autentikasi pengguna (Login, Aktivasi, Profil).
 */
const User = require('../models/User'); 
const jwt = require('jsonwebtoken');
const ActivityLog = require('../models/ActivityLog'); 
const { Op } = require('sequelize');

/**
 * Fungsi untuk membuat token JWT.
 * @param {number} id - ID pengguna.
 * @returns {string} Token JWT.
 */
const generateToken = (id) => {
  // Gunakan rahasia dari env, atau fallback ke teks default jika belum diatur
  const secret = process.env.JWT_SECRET || 'office_equipment_secret_key_2024';
  // Gunakan durasi dari env (misal: 7d), atau fallback ke 1 hari (86400 detik)
  const expiresIn = process.env.JWT_EXPIRE || '1d';
  
  return jwt.sign({ id }, secret, { expiresIn });
};

/**
 * @desc    Login pengguna
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    // Mencari pengguna berdasarkan Email atau NIP
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { nip: identifier }
        ]
      }
    });

    // Jika pengguna tidak ditemukan
    if (!user) {
      return res.status(401).json({
        message: 'NIP/Email not registered',
        field: 'identifier'
      });
    }

    // Jika akun dinonaktifkan oleh administrator
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated. Please contact Admin.' });
    }

    // Memeriksa apakah akun sudah diaktivasi (khusus non-admin)
    if (!user.isActivated && user.role !== 'admin') {
      return res.status(401).json({ message: 'Account not activated. Please activate your account first.' });
    }

    // Verifikasi password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Incorrect password',
        field: 'password'
      });
    }

    // Memperbarui waktu login terakhir
    user.lastLogin = new Date();
    await user.save();

    // Mencatat aktivitas login ke dalam log database
    await ActivityLog.create({
      userId: user.id,
      action: 'User login',
      entityType: 'user',
      details: { loginMethod: 'nip/password' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Mengirim respon berisi data pengguna dan token
    res.json({
      id: user.id,
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
    res.status(500).json({ message: 'System error during login', error: error.message });
  }
};

/**
 * @desc    Cek NIP untuk proses aktivasi akun
 * @route   POST /api/auth/check-activation
 * @access  Public
 */
const checkActivation = async (req, res) => {
  try {
    const { nip } = req.body;
    const user = await User.findOne({ where: { nip } });

    if (!user) {
      return res.status(404).json({ message: 'NIP not found. Please ensure your NIP has been registered by Administrator.' });
    }

    if (user.isActivated) {
      return res.status(400).json({ 
        message: 'Account with this NIP is already activated. Please login.',
        alreadyActivated: true 
      });
    }

    res.json({ success: true, nip: user.nip, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Proses aktivasi akun (mengatur password dan profil)
 * @route   POST /api/auth/activate
 * @access  Public
 */
const activateAccount = async (req, res) => {
  try {
    const { nip, fullName, email, password, department, position, phone } = req.body;

    const user = await User.findOne({ where: { nip } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isActivated) {
      return res.status(400).json({ message: 'Account already active' });
    }

    // Memperbarui data profil dan status aktivasi
    await user.update({
      fullName,
      email,
      password, // Bcrypt hook di model akan menangani hashing secara otomatis
      department,
      position,
      phone,
      isActivated: true,
      isActive: true
    });

    // Mencatat log aktivitas aktivasi
    await ActivityLog.create({
      userId: user.id,
      action: 'Account self-activated',
      entityType: 'user',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      message: 'Activation successful! Welcome. Please login using your NIP.',
      success: true
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        message: 'Email is already in use by another account.',
        field: 'email'
      });
    }
    res.status(500).json({ message: 'Activation failed: ' + error.message });
  }
};

/**
 * @desc    Mendapatkan data pengguna yang sedang login
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Memperbarui preferensi tema (Light/Dark)
 * @route   PUT /api/auth/theme
 * @access  Private
 */
const updateTheme = async (req, res) => {
  try {
    const { themePreference } = req.body;

    if (!['light', 'dark'].includes(themePreference)) {
      return res.status(400).json({ message: 'Invalid theme selection' });
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
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Memperbarui profil pengguna
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, department, position, phone } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
      return res.status(400).json({ 
        message: 'Email is already in use by another account.',
        field: 'email'
      });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Mengubah password pengguna
 * @route   PUT /api/auth/password
 * @access  Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verifikasi password saat ini
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ 
        message: 'Incorrect current password',
        field: 'currentPassword'
      });
    }

    // Simpan password baru (akan di-hash otomatis oleh hook model)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Keluar dari sistem (Logout)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // Mencatat log aktivitas logout
    await ActivityLog.create({
      userId: req.user.id,
      action: 'User logout',
      entityType: 'user',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
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