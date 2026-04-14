const express = require('express');
const router = express.Router();

/**
 * File Indeks Rute - Menggabungkan semua rute sub-modul ke dalam satu router utama.
 */

// Mengimpor rute untuk masing-masing modul
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const itemRoutes = require('./itemRoutes');
const categoryRoutes = require('./categoryRoutes');
const borrowingRoutes = require('./borrowingRoutes');
const notificationRoutes = require('./notificationRoutes');
const reportRoutes = require('./reportRoutes');
const activityLogRoutes = require('./activityLogRoutes');

// Mendaftarkan rute ke router utama dengan prefix yang sesuai
router.use('/auth', authRoutes);         // Rute autentikasi (Login, Register, dsb)
router.use('/users', userRoutes);       // Rute manajemen pengguna
router.use('/items', itemRoutes);       // Rute manajemen alat kantor
router.use('/categories', categoryRoutes); // Rute kategori alat
router.use('/borrowings', borrowingRoutes); // Rute peminjaman dan pengembalian
router.use('/notifications', notificationRoutes); // Rute notifikasi sistem
router.use('/reports', reportRoutes);    // Rute dashboard dan laporan
router.use('/activity-logs', activityLogRoutes); // Rute log aktivitas pengguna

module.exports = router;