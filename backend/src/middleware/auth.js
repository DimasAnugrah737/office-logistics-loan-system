/**
 * Middleware untuk menangani autentikasi JWT dan otorisasi peran pengguna.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware: protect
 * Digunakan untuk memproteksi rute yang memerlukan login (autentikasi).
 * Memeriksa token Bearer dalam header Authorization.
 */
const protect = async (req, res, next) => {
  let token;

  // Memeriksa apakah ada token di header Authorization
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Mengambil token dari string format "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // Memverifikasi validitas token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Mengambil data pengguna dari database berdasarkan ID yang ada di token
      // Kita mengecualikan field 'password' demi keamanan
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      // Validasi: Apakah pengguna masih ada di database?
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      // Validasi: Apakah akun pengguna aktif?
      if (!req.user.isActive) {
        return res.status(401).json({ message: 'Account has been deactivated' });
      }

      // Lanjut ke middleware atau controller berikutnya
      next();
    } catch (error) {
      console.error('Error pada middleware auth:', error);
      return res.status(401).json({ message: 'Not authorized, invalid token' });
    }
  }

  // Jika tidak ada token sama sekali
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }
};

/**
 * Middleware: authorize
 * Digunakan untuk membatasi akses rute berdasarkan peran (role) tertentu (misal: admin, officer).
 * @param {...string} roles - Daftar peran yang diizinkan (misal: 'admin', 'officer')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Pastikan req.user sudah diisi oleh middleware protect
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Memeriksa apakah role pengguna termasuk dalam daftar role yang diizinkan
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied: Role ${req.user.role} is not authorized for this action` });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize
};