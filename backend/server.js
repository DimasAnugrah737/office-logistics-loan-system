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

// 1. LOGGER REQUEST (PALING ATAS - UNTUK DEBUG 405)
app.use((req, res, next) => {
  console.log(`>>> [DEBUG] ${req.method} ${req.url}`);
  next();
});

// 2. CORS (PENTING UNTUK VERCEL)
app.use(cors({
  origin: true,
  credentials: true
}));

// 3. MIDDLEWARE STANDAR
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 4. LOG AKTIVITAS
app.use(logActivity);

// 5. RUTE DEBUG & SETUP ADMIN (Hanya untuk inisialisasi pertama)
app.get('/api/debug', (req, res) => {
  res.json({ message: 'API connection is working!', time: new Date() });
});

app.get('/api/setup-admin', async (req, res) => {
  try {
    const User = require('./src/models/User');
    const existingUser = await User.findOne();
    
    if (existingUser) {
      return res.json({ message: 'User sudah ada di database. Rute ini sudah tidak bisa digunakan.' });
    }

    const admin = await User.create({
      nip: 'admin',
      name: 'Super Admin',
      email: 'admin@example.com',
      password: 'admin123', // Password default
      role: 'admin',
      isActivated: true
    });

    res.json({ 
      message: 'Akun Admin berhasil dibuat!', 
      login: 'nip: admin | password: admin123' 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. RUTE API UTAMA
app.use('/api', routes);

// 7. ROOT HEALTH CHECK
app.get('/', (req, res) => {
  res.json({ 
    message: 'Office Equipment Management System API is online!',
    database: 'connected'
  });
});

// Middleware penanganan error global
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err.stack);
  try {
    fs.appendFileSync('error.log', `${new Date().toISOString()} - ${req.method} ${req.url} - ${err.message}\n${err.stack}\n\n`);
  } catch (logErr) {}
  
  res.status(500).json({
    message: 'Terjadi kesalahan sistem!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Menentukan HOST dan PORT server secara dinamis untuk cloud platforms
const HOST = '0.0.0.0';
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