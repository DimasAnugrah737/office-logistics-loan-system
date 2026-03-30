const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  fullName: {
    type: DataTypes.STRING,
    allowNull: true
  },

  nip: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },

  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true,
      isLowercase: true
    }
  },

  password: {
    type: DataTypes.STRING,
    allowNull: true
  },

  isActivated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  role: {
    type: DataTypes.ENUM('admin', 'officer', 'user'),
    defaultValue: 'user'
  },

  department: {
    type: DataTypes.STRING
  },

  position: {
    type: DataTypes.STRING
  },

  phone: {
    type: DataTypes.STRING
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

  lastLogin: {
    type: DataTypes.DATE
  },

  themePreference: {
    type: DataTypes.ENUM('light', 'dark'),
    defaultValue: 'light'
  },

  isBlockedFromBorrowing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  blockReason: {
    type: DataTypes.STRING,
    allowNull: true
  }

}, {
  tableName: 'users',        // WAJIB: sesuai nama tabel di phpMyAdmin
  freezeTableName: true,     // Jangan diubah jadi plural
  timestamps: true,
  paranoid: true,

  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },

    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});


// Method untuk compare password saat login
User.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  delete values.password; // Security best practice
  return values;
};

module.exports = User;
