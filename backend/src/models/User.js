// Mengimpor tipe data dari Sequelize
const { DataTypes } = require('sequelize');
// Mengimpor bcryptjs untuk hashing password
const bcrypt = require('bcryptjs');
// Mengimpor instance sequelize yang sudah dikonfigurasi
const { sequelize } = require('../config/database');

/**
 * Model User untuk mengelola data pengguna dalam sistem.
 */
const User = sequelize.define('User', {
  // ID unik untuk setiap pengguna (Primary Key)
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },

  // Nama lengkap pengguna
  fullName: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Nomor Induk Pegawai (NIP) - Digunakan sebagai pengenal unik/login
  nip: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },

  // Alamat email pengguna
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    validate: {
      isEmail: true,
      isLowercase: true
    }
  },

  // Password yang sudah di-hash
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },

  // Status apakah akun sudah diaktivasi atau belum
  isActivated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  // Peran pengguna dalam sistem (admin, officer, atau user biasa)
  role: {
    type: DataTypes.ENUM('admin', 'officer', 'user'),
    defaultValue: 'user'
  },

  // Departemen tempat pengguna bekerja
  department: {
    type: DataTypes.STRING
  },

  // Jabatan pengguna
  position: {
    type: DataTypes.STRING
  },

  // Nomor telepon pengguna
  phone: {
    type: DataTypes.STRING
  },

  // Status aktif akun (bisa dinonaktifkan oleh admin)
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },

  // Waktu terakhir login
  lastLogin: {
    type: DataTypes.DATE
  },

  // Preferensi tema tampilan (terang/gelap)
  themePreference: {
    type: DataTypes.ENUM('light', 'dark'),
    defaultValue: 'light'
  },

  // Status apakah pengguna dilarang meminjam alat (misal karena sering telat)
  isBlockedFromBorrowing: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  // Alasan pemblokiran (jika ada)
  blockReason: {
    type: DataTypes.STRING,
    allowNull: true
  }

}, {
  // Nama tabel di database
  tableName: 'users',        
  freezeTableName: true,     
  // Menambahkan kolom createdAt dan updatedAt otomatis
  timestamps: true,
  // Mengaktifkan soft delete (kolom deletedAt)
  paranoid: true,

  // Hooks (pemicu otomatis) pada siklus hidup data
  hooks: {
    // Dipanggil sebelum data baru dibuat
    beforeCreate: async (user) => {
      // Hashing password jika belum di-hash
      if (user.password && !user.password.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },

    // Dipanggil sebelum data diperbarui
    beforeUpdate: async (user) => {
      // Re-hash password hanya jika ada perubahan pada password
      if (user.changed('password') && user.password && !user.password.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});


/**
 * Method untuk membandingkan password yang diinput dengan hash di database.
 */
User.prototype.comparePassword = async function (candidatePassword) {
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  return isMatch;
};

/**
 * Filter data JSON yang dikirim ke klien (menghapus password demi keamanan).
 */
User.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  delete values.password; // Menjamin password tidak bocor ke frontend
  return values;
};

module.exports = User;
