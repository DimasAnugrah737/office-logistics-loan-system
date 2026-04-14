const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const { emitToAll } = require('../utils/socket');

/**
 * @desc    Membuat pengguna baru (Hanya Admin)
 * @route   POST /api/users
 * @access  Private/Admin
 */
const createUser = async (req, res) => {
  try {
    const { fullName, nip, email, password, role, department, position, phone } = req.body;

    // 1. Validasi Duplikasi: Pastikan Email atau NIP belum terdaftar
    const userExists = await User.findOne({
      where: {
        [Op.or]: [
          ...(email ? [{ email }] : []),
          { nip }
        ]
      }
    });

    if (userExists) {
      return res.status(400).json({
        message: userExists.nip === nip ? 'NIP already registered' : 'Email already in use by another account',
        field: userExists.nip === nip ? 'nip' : 'email'
      });
    }

    const createData = {
      fullName: fullName || null,
      nip,
      email: email || null,
      password: password || null,
      role: role || 'user',
      department: department || null,
      position: position || null,
      phone: phone || null,
      isActivated: !!password
    };

    // 2. Buat Pengguna baru di database
    const user = await User.create(createData);

    // 3. Catat Log Aktivitas Admin
    await ActivityLog.create({
      userId: req.user.id,
      action: `register new users (NIP: ${nip}, Role: ${role})`,
      entityType: 'user',
      entityId: user.id
    });

    const userResponse = {
      id: user.id,
      fullName: user.fullName,
      nip: user.nip,
      email: user.email,
      role: user.role,
      department: user.department,
      position: user.position,
      phone: user.phone,
      isActive: user.isActive
    };

    // Sinkronisasi real-time via Socket.io
    emitToAll('user:created', userResponse);

    res.status(201).json(userResponse);
  } catch (error) {
    console.error('SERVER ERROR (createUser):', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: 'Validation Error: ' + error.errors.map(e => e.message).join(', '),
        field: error.errors[0].path,
        rawError: 'Validation error'
      });
    }
    res.status(500).json({
      message: 'System error while creating user',
      error: error.message,
      rawError: error.name
    });
  }
};

/**
 * @desc    Mengambil semua daftar pengguna dengan Pagination dan Filter
 * @route   GET /api/users
 * @access  Private/Admin
 */
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (role && role !== 'all') whereClause.role = role;

    // Pencarian berdasarkan Nama, NIP, atau Email
    if (search) {
      whereClause[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { nip: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      attributes: { exclude: ['password'] },
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0
    });

    res.json({
      users,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Failed to get users list:', error);
    res.status(500).json({ message: 'System error occurred' });
  }
};

/**
 * @desc    Mengambil detail satu pengguna berdasarkan ID
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Failed to get user details:', error);
    res.status(500).json({ message: 'System error occurred' });
  }
};

/**
 * @desc    Memperbarui data pengguna oleh Admin
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
const updateUser = async (req, res) => {
  try {
    const { fullName, nip, email, role, department, position, phone, isActive } = req.body;
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 1. Validasi Duplikasi Email (jika diubah)
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ where: { email, id: { [Op.ne]: user.id } } });
      if (emailExists) return res.status(400).json({ message: 'Email already in use', field: 'email' });
    }

    // 2. Validasi Duplikasi NIP (jika diubah)
    if (nip && nip !== user.nip) {
      const nipExists = await User.findOne({ where: { nip, id: { [Op.ne]: user.id } } });
      if (nipExists) return res.status(400).json({ message: 'NIP already registered by another user', field: 'nip' });
    }

    // 3. Simpan Perubahan
    await user.update({
      fullName: fullName === undefined ? user.fullName : (fullName || null),
      nip: nip === undefined ? user.nip : nip,
      email: email === undefined ? user.email : (email || null),
      role: role === undefined ? user.role : role,
      department: department === undefined ? user.department : (department || null),
      position: position === undefined ? user.position : (position || null),
      phone: phone === undefined ? user.phone : (phone || null),
      isActive: isActive !== undefined ? isActive : user.isActive
    });

    await ActivityLog.create({
      userId: req.user.id,
      action: `Update user data: ${user.fullName}`,
      entityType: 'user',
      entityId: user.id,
      details: { role, isActive }
    });

    const userResponse = {
      id: user.id,
      fullName: user.fullName,
      nip: user.nip,
      email: user.email,
      role: user.role,
      department: user.department,
      position: user.position,
      phone: user.phone,
      isActive: user.isActive
    };

    // Sinkronkan ke client secara real-time
    emitToAll('user:updated', userResponse);

    res.json(userResponse);
  } catch (error) {
    console.error('Failed to update user:', error);
    res.status(500).json({
      message: 'System error while updating user',
      error: error.message
    });
  }
};

/**
 * @desc    Menghapus pengguna beserta seluruh datanya (LOGIKA BERSIH)
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      await t.rollback();
      return res.status(404).json({ message: 'User not found' });
    }

    // Pelindung: Larangan menghapus diri sendiri untuk mencegah lockout total
    if (user.id === req.user.id) {
      await t.rollback();
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    // Pelindung: Jangan hapus Administrator terakhir di sistem
    if (user.role === 'admin') {
      const adminCount = await User.count({ where: { role: 'admin' }, transaction: t });
      if (adminCount <= 1) {
        await t.rollback();
        return res.status(400).json({ message: 'Failed: Cannot delete the only remaining Administrator in the system.' });
      }
    }

    // --- PEMBERSIHAN DATA TERKAIT (Manual Cleanup) ---
    // 1. Log Aktivitas yang dibuat oleh user tersebut
    await ActivityLog.destroy({ where: { userId: user.id }, transaction: t });

    // 2. Notifikasi pengguna
    const Notification = require('../models/Notification');
    await Notification.destroy({ where: { userId: user.id }, transaction: t });

    // 3. Catatan Peminjaman (Riwayat)
    const Borrowing = require('../models/Borrowing');
    await Borrowing.destroy({ where: { userId: user.id }, transaction: t });

    // 4. Barang & Kategori yang pernah dibuat oleh user ini
    const Item = require('../models/Item');
    const Category = require('../models/Category');
    await Item.destroy({ where: { createdBy: user.id }, transaction: t, force: true });
    await Category.destroy({ where: { createdBy: user.id }, transaction: t, force: true });

    // 5. Kosongkan referensi persetujuan pada peminjaman barang lain (agar data histori tetap ada)
    await Borrowing.update({ approvedBy: null }, { where: { approvedBy: user.id }, transaction: t });
    await Borrowing.update({ returnApprovedBy: null }, { where: { returnApprovedBy: user.id }, transaction: t });

    await ActivityLog.create({
      userId: req.user.id,
      action: `Delete user: ${user.fullName}`,
      entityType: 'user',
      entityId: user.id
    }, { transaction: t });

    // Akhiri: Hapus inti data pengguna secara fisik dari database (Force Delete)
    await user.destroy({ transaction: t, force: true });

    await t.commit();

    emitToAll('user:deleted', { id: req.params.id });
    res.json({ message: 'User successfully deleted along with all their data' });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Failed to delete user:', error);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

/**
 * @desc    Mereset password pengguna ke default (123456)
 * @route   PUT /api/users/:id/reset-password
 * @access  Private/Admin
 */
const resetPassword = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Membuat password acak yang aman
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let newPassword = '';
    for (let i = 0; i < 12; i++) {
      newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    user.password = newPassword;
    await user.save();

    await ActivityLog.create({
      userId: req.user.id,
      action: `Reset password for user: ${user.fullName || user.nip}`,
      entityType: 'user',
      entityId: user.id,
      details: { method: 'admin_reset' }
    });

    res.json({
      message: `Password reset successfully.`,
      tempPassword: newPassword
    });
  } catch (error) {
    console.error('Failed to reset password:', error);
    res.status(500).json({ message: 'System error occurred' });
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  resetPassword
};