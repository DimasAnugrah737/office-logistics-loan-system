require('dotenv').config();
const { sequelize } = require('../config/database');
const User = require('../models/User');

const createAdmin = async () => {
  try {
    await sequelize.sync();

    const existingAdmin = await User.findOne({
      where: { email: 'admin@office.com' }
    });

    if (existingAdmin) {
      console.log('Admin already exists');
      process.exit();
    }

    await User.create({
      fullName: 'Administrator',
      nip: 'ADMIN001',
      email: 'admin@office.com',
      password: 'admin123',
      role: 'admin',
      department: 'IT',
      position: 'System Administrator'
    });

    console.log('Admin created successfully!');
    process.exit();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

createAdmin();
