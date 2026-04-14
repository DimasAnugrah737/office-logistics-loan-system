const { updateUser, createUser } = require('./src/controllers/userController');
const { sequelize } = require('./src/config/database');

async function test() {
  await sequelize.authenticate();
  
  // Create mock request to reproduce the issue
  const req = {
    body: {
      fullName: 'Engineer',
      nip: 'ENG001',
      email: '',
      role: 'officer',
      department: 'Engineer',
      position: '',
      phone: '',
      isActive: true,
    },
    params: {
      id: 1 // Attempting to update a user ID that might cause it
    },
    user: { id: 1 } // Auth mock
  };

  const res = {
    status: (code) => {
      console.log('STATUS:', code);
      return res;
    },
    json: (data) => {
      console.log('JSON:', data);
      return res;
    }
  };

  console.log("Testing UpdateUser:");
  await updateUser(req, res);
  
  process.exit(0);
}

test().catch(console.error);
