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
      ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT ? {
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
 */
const connectDB = async () => {
  try {
    // 1. Menguji koneksi autentikasi ke database
    await sequelize.authenticate();
    console.log(`MySQL Connected: ${process.env.DB_HOST}:${process.env.DB_PORT}`);

    // 2. Sinkronisasi model Sequelize dengan tabel database
    // alter: false berarti tidak mengubah struktur tabel yang sudah ada secara otomatis (lebih aman)
    await sequelize.sync({ alter: false });
    
    // 3. Pastikan kolom yang diperlukan tersedia di tabel (Migrasi manual via SQL Query)
    try {
      // Menambahkan kolom lastNotificationAt jika belum ada
      await sequelize.query("ALTER TABLE borrowings ADD COLUMN lastNotificationAt DATETIME NULL;");
      console.log('Column lastNotificationAt added successfully');
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) {
        console.error('Error adding column to borrowings:', e.message);
      }
    }

    try {
      // Menambahkan kolom brokenQuantity ke tabel items
      await sequelize.query("ALTER TABLE items ADD COLUMN brokenQuantity INT DEFAULT 0;");
      console.log('Column brokenQuantity added successfully to items table');
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) {
        console.error('Error adding column items.brokenQuantity:', e.message);
      }
    }

    try {
      // Menambahkan kolom code ke tabel categories
      await sequelize.query("ALTER TABLE categories ADD COLUMN code VARCHAR(255) NOT NULL DEFAULT 'TEMP';");
      console.log('Column code added successfully to categories table');
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) {
        console.error('Error adding column categories.code:', e.message);
      }
    }

    try {
      // Pastikan kolom specifications ada (untuk jaga-jaga)
      await sequelize.query("ALTER TABLE items ADD COLUMN specifications JSON NULL;");
      console.log('Column specifications added successfully');
    } catch (e) {
      if (!e.message.includes('Duplicate column name')) {
        // Abaikan jika tipe JSON tidak didukung atau kolom sudah ada
      }
    }

    // 4. Sinkronisasi tabel damage_reports secara manual (agar lebih fleksibel)
    try {
      const DamageReport = require('../models/DamageReport');
      await DamageReport.sync();
      console.log('Table damage_reports synchronized successfully');
    } catch (e) {
      console.error('Error synchronizing damage_reports table:', e.message);
    }

    // 5. Memperbarui tipe data ENUM pada tabel notifications
    try {
      await sequelize.query("ALTER TABLE notifications MODIFY COLUMN type ENUM('borrow_request', 'borrow_approved', 'borrow_rejected', 'return_request', 'return_approved', 'overdue_warning', 'system') DEFAULT 'system';");
      console.log('Notification enum updated successfully');
    } catch (e) {
      console.error('Error updating enum:', e.message);
    }

    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1); // Hentikan server jika database gagal terhubung
  }
};

module.exports = {
  sequelize,
  connectDB
};
