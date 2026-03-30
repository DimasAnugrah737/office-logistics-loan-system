const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' ? {
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

const connectDB = async () => {
  try {
    // Test koneksi
    await sequelize.authenticate();
    console.log(`MySQL Connected: ${process.env.DB_HOST}:${process.env.DB_PORT} `);

    // Sinkronisasi tabel (Gunakan alter: false jika ada error "Too many keys")
    await sequelize.sync({ alter: false });

    console.log('Database synchronized successfully');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

module.exports = {
  sequelize,
  connectDB
};
