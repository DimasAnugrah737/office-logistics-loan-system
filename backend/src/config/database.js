/**
 * File Konfigurasi Database menggunakan Sequelize ORM.
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

/**
 * Inisialisasi instance Sequelize dengan parameter dari variabel lingkungan.
 * Mendukung variabel standar (DB_*) dan variabel otomatis dari Railway (MYSQL*).
 */
const sequelize = process.env.DATABASE_URL 
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      dialectOptions: {
        ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT ? {
          rejectUnauthorized: false
        } : false
      }
    })
  : new Sequelize(
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
 * Dilengkapi dengan mekanisme retry untuk menangani jeda startup pada cloud platform.
 */
const connectDB = async (retries = 5) => {
  while (retries) {
    try {
      if (process.env.DATABASE_URL) {
        console.log('Mencoba menghubungkan ke Database menggunakan DATABASE_URL...');
      } else {
        console.log(`Mencoba menghubungkan ke Database di ${process.env.DB_HOST || process.env.MYSQLHOST || 'localhost'}:${process.env.DB_PORT || process.env.MYSQLPORT || '3306'}...`);
      }
      
      // 1. Menguji koneksi autentikasi ke database
      await sequelize.authenticate();
      if (process.env.DATABASE_URL) {
        console.log('MySQL Connected via DATABASE_URL');
      } else {
        console.log(`MySQL Connected: ${process.env.DB_HOST || process.env.MYSQLHOST}:${process.env.DB_PORT || process.env.MYSQLPORT}`);
      }

      // 2. Sinkronisasi model Sequelize - Mode Normal (Alter)
      // Kita kembalikan ke alter: true agar data tidak terhapus setiap restart
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      await sequelize.sync({ alter: true });
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      
      console.log('Database synchronized successfully (Normal Mode)');
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
