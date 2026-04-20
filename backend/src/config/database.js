/**
 * File Konfigurasi Database menggunakan Sequelize ORM.
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

/**
 * Inisialisasi instance Sequelize dengan parameter dari variabel lingkungan.
 * Mendukung variabel standar (DB_*) dan variabel otomatis dari Railway (MYSQL*).
 */
const sequelize = new Sequelize(
  process.env.DB_NAME || process.env.MYSQLDATABASE,
  process.env.DB_USER || process.env.MYSQLUSER,
  process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
  {
    host: process.env.DB_HOST || process.env.MYSQLHOST,
    port: process.env.DB_PORT || process.env.MYSQLPORT,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

/**
 * Fungsi untuk menghubungkan ke database dan melakukan sinkronisasi struktur tabel.
 * Dilengkapi dengan mekanisme retry untuk menangani jeda startup pada cloud platform.
 */
const connectDB = async (retries = 5) => {
  while (retries) {
    try {
      console.log(`Mencoba menghubungkan ke Database di ${process.env.DB_HOST || process.env.MYSQLHOST || 'localhost'}:${process.env.DB_PORT || process.env.MYSQLPORT || '3306'}...`);
      
      // 1. Menguji koneksi autentikasi ke database
      await sequelize.authenticate();
      console.log(`MySQL Connected: ${process.env.DB_HOST || process.env.MYSQLHOST}:${process.env.DB_PORT || process.env.MYSQLPORT}`);

      // 2. Sinkronisasi model Sequelize dengan tabel database
      await sequelize.sync({ alter: false });
      
      // 3. Pastikan kolom yang diperlukan tersedia di tabel
      // (Logika migrasi manual dipertahankan)
      try {
        await sequelize.query("ALTER TABLE borrowings ADD COLUMN lastNotificationAt DATETIME NULL;");
      } catch (e) {}

      try {
        await sequelize.query("ALTER TABLE items ADD COLUMN brokenQuantity INT DEFAULT 0;");
      } catch (e) {}

      try {
        await sequelize.query("ALTER TABLE categories ADD COLUMN code VARCHAR(255) NOT NULL DEFAULT 'TEMP';");
      } catch (e) {}

      try {
        await sequelize.query("ALTER TABLE items ADD COLUMN specifications JSON NULL;");
      } catch (e) {}

      try {
        const DamageReport = require('../models/DamageReport');
        await DamageReport.sync();
      } catch (e) {}

      try {
        await sequelize.query("ALTER TABLE notifications MODIFY COLUMN type ENUM('borrow_request', 'borrow_approved', 'borrow_rejected', 'return_request', 'return_approved', 'overdue_warning', 'system') DEFAULT 'system';");
      } catch (e) {}

      console.log('Database synchronized successfully');
      return; // Berhasil, keluar dari loop

    } catch (error) {
      retries -= 1;
      console.error(`Gagal terhubung ke database. Sisa percobaan: ${retries}`);
      console.error('Pesan Error:', error.message);
      
      if (retries === 0) {
        console.error('Seluruh percobaan koneksi gagal. Mematikan server...');
        process.exit(1);
      }
      
      // Tunggu 5 detik sebelum mencoba lagi
      console.log('Menunggu 5 detik sebelum mencoba kembali...');
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

module.exports = {
  sequelize,
  connectDB
};
