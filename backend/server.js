// Mengimpor modul express untuk membuat server web
const express = require('express');

// Mengimpor modul dotenv untuk membaca variabel lingkungan dari file .env
const dotenv = require('dotenv');
// Mengimpor modul cors untuk menangani Cross-Origin Resource Sharing
const cors = require('cors');
// Mengimpor modul fs untuk manipulasi file sistem
const fs = require('fs');

// Memuat variabel lingkungan dari .env ke process.env
dotenv.config();

// Menangani error yang tidak tertangkap (uncaught exception) agar server tidak langsung mati tanpa log
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  fs.writeFileSync('server_crash.log', `Uncaught Exception: ${err.message}\n${err.stack}`);
  process.exit(1);
});

// Menangani penolakan promise yang tidak ditangani (unhandled rejection)
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  fs.writeFileSync('server_crash.log', `Unhandled Rejection: ${reason}\n`);
  process.exit(1);
});

// Mengimpor konfigurasi database dan komponen internal lainnya
const { connectDB } = require('./src/config/database');
const routes = require('./src/routes');
const logActivity = require('./src/middleware/logger');
const { checkOverdueBorrowings } = require('./src/controllers/borrowingController');

// Memuat semua model sebelum mengatur asosiasi antar tabel
require('./src/models/User');
require('./src/models/Category');
require('./src/models/Item');
require('./src/models/Borrowing');
require('./src/models/Notification');
require('./src/models/ActivityLog');

// Mengatur relasi antar model database
const setupAssociations = require('./src/models/associations');

// Mengimpor modul http dan socket.io untuk komunikasi real-time
const http = require('http');
const { initSocket } = require('./src/utils/socket');

// Middleware untuk keamanan dan performa
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Inisialisasi aplikasi express dan server http
const app = express();
const server = http.createServer(app);

// Middleware CORS kustom untuk mengizinkan akses dari berbagai origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Middleware keamanan Helmet untuk melindungi dari kerentanan umum
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Pembatasan jumlah permintaan (Rate Limiting) untuk mencegah penyalahgunaan API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 1000, // Maksimal 1000 permintaan per 15 menit
  message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Pembatasan percobaan login yang lebih ketat untuk keamanan akun
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  message: { message: 'Terlalu banyak percobaan login, silakan coba lagi dalam 15 menit' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);

// Mengaktifkan kompresi Gzip untuk mempercepat pengiriman data
app.use(compression());

// Parser untuk data JSON dan URL-encoded dari permintaan klien
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const path = require('path');

// Middleware untuk mencatat aktivitas log (monitoring)
app.use(logActivity);

// Definisi rute API utama
app.use('/api', routes);

// Mengizinkan akses publik ke folder unggahan (untuk gambar/file item)
app.use('/uploads', express.static('uploads'));

// Menyajikan file statis dari build aplikasi React (Frontend)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Menangani permintaan rute yang tidak dikenal dengan mengirimkan ke index.html React
app.get(/^(?!\/(api|uploads)).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Middleware penanganan error global
app.use((err, req, res, next) => {
  console.error(err.stack);
  try {
    // Mencatat error ke file error.log
    fs.appendFileSync('error.log', `${new Date().toISOString()} - ${req.method} ${req.url} - ${err.message}\n${err.stack}\n\n`);
  } catch (logErr) {
    console.error('Gagal menulis ke error.log:', logErr);
  }
  res.status(500).json({
    message: 'Terjadi kesalahan sistem!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Menentukan HOST dan PORT server
const args = process.argv.slice(2);
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 5001;

// Fungsi untuk memulai server secara asinkron
const startServer = async () => {
  try {
    // 1. Mengatur asosiasi database
    setupAssociations();
    // 2. Menghubungkan ke database
    await connectDB();

    // Migrasi data: Mengaktifkan akun lama yang sudah punya password tapi belum aktif
    try {
      const User = require('./src/models/User');
      const { Op } = require('sequelize');
      await User.update(
        { isActivated: true },
        { where: { password: { [Op.ne]: null }, isActivated: false } }
      );
      console.log('Migrasi: Status isActivated telah diperbarui untuk akun yang memiliki password');
    } catch (migErr) {
      console.warn('Peringatan migrasi (isActivated):', migErr.message);
    }

    // Inisialisasi Socket.io untuk notifikasi real-time
    initSocket(server);

    // Menjalankan server pada port yang ditentukan
    server.listen(PORT, HOST, () => {
      console.log(`Server berjalan di http://${HOST}:${PORT} dalam mode ${process.env.NODE_ENV}`);
      console.log('Server berhasil dimulai ulang dengan dukungan Socket.io');
    });

    // Menjalankan pengecekan peminjaman yang jatuh tempo setiap jam
    if (typeof checkOverdueBorrowings === 'function') {
      setInterval(checkOverdueBorrowings, 60 * 60 * 1000);
    } else {
      console.error('Error: checkOverdueBorrowings bukan fungsi saat server dimulai');
    }

  } catch (err) {
    console.error('Gagal menjalankan server:', err);
    fs.writeFileSync('server_error.log', `Server start error: ${err.message}\n${err.stack}`);
    process.exit(1);
  }
};

// Panggil fungsi untuk memulai server
startServer();