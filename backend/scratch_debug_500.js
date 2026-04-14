const { sequelize } = require('./src/config/database');
const User = require('./src/models/User');

async function debugModel() {
  await sequelize.authenticate();
  try {
    const errorBody = {
      fullName: '',
      nip: 'NEW_TEST_999',
      email: '',
      password: '',
      role: 'user',
      department: '',
      position: '',
      phone: '',
      isActive: true,
      isActivated: false
    };

    // Simulate CreateData
    const createData = {
      fullName: errorBody.fullName || null,
      nip: errorBody.nip,
      email: errorBody.email || null,
      password: errorBody.password || null,
      role: errorBody.role || 'user',
      department: errorBody.department || null,
      position: errorBody.position || null,
      phone: errorBody.phone || null,
      isActivated: !!errorBody.password
    };
    
    console.log("Attempting to create user with:", createData);
    const user = await User.create(createData);
    console.log("Create success!");
    await user.destroy();
  } catch (e) {
    console.error("Create Crash:", e);
  }

  process.exit();
}
debugModel();
