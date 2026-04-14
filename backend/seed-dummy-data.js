require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize } = require('./src/config/database');
const User = require('./src/models/User');
const Category = require('./src/models/Category');

const seedDummyData = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    // Sync models (create if not exists)
    await sequelize.sync();
    console.log('Database synced');
    
    const hashedPasswordAdmin = await bcrypt.genSalt(10).then(salt => bcrypt.hash('admin123', salt));
    const hashedPasswordUser = await bcrypt.genSalt(10).then(salt => bcrypt.hash('password123', salt));

    const users = [
      {
        fullName: 'Admin User',
        nip: 'ADM001',
        email: 'admin@office.com',
        password: hashedPasswordAdmin,
        role: 'admin',
        department: 'IT',
        position: 'System Administrator'
      },
      {
        fullName: 'Bob Officer',
        nip: 'OFF001',
        email: 'bob@office.com',
        password: hashedPasswordUser,
        role: 'officer',
        department: 'Operations',
        position: 'Equipment Officer'
      },
      {
        fullName: 'John Doe',
        nip: 'EMP001',
        email: 'john@office.com',
        password: hashedPasswordUser,
        role: 'user',
        department: 'HR',
        position: 'Manager'
      }
    ];

    for (const userData of users) {
      await User.upsert(userData);
    }
    console.log('Dummy users created');

    // Create dummy categories
    const categories = [
      { name: 'Electronics', description: 'Electronic devices and gadgets', createdBy: 1 },
      { name: 'Furniture', description: 'Office furniture and seating', createdBy: 1 },
      { name: 'Stationery', description: 'Office supplies and stationery', createdBy: 2 },
      { name: 'Vehicles', description: 'Company vehicles and transportation', createdBy: 1 }
    ];

    for (const categoryData of categories) {
      await Category.upsert(categoryData);
    }
    console.log('Dummy categories created');

    console.log('Dummy data seeded successfully!');
    console.log('Login credentials for dummy users:');
    console.log('Admin: admin@office.com / admin123');
    console.log('Officer: bob@office.com / password123');
    console.log('User: john@office.com / password123');

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding dummy data:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

seedDummyData();