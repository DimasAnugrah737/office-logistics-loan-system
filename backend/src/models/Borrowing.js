const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Model Borrowing untuk mengelola data peminjaman barang.
 */
const Borrowing = sequelize.define('Borrowing', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  // ID Pengguna yang meminjam
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // ID Barang yang dipinjam
  itemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'items',
      key: 'id'
    }
  },
  // Jumlah barang yang dipinjam
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  // Tanggal barang dipinjam
  borrowDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  // Tanggal yang diharapkan untuk pengembalian barang
  expectedReturnDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  // Tanggal aktual barang dikembalikan
  actualReturnDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Tujuan peminjaman barang
  purpose: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Status peminjaman barang
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'borrowed', 'returning', 'returned', 'cancelled', 'overdue'),
    defaultValue: 'pending'
  },
  // ID Pengguna yang menyetujui peminjaman
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Waktu penyetujuan peminjaman
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // ID Pengguna yang menyetujui pengembalian
  returnApprovedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Waktu penyetujuan pengembalian
  returnApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Catatan tambahan untuk peminjaman
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Besar denda jika ada keterlambatan atau kerusakan
  penalty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  // Status pembayaran denda
  penaltyStatus: {
    type: DataTypes.ENUM('none', 'unpaid', 'paid'),
    defaultValue: 'none'
  },
  // Catatan tambahan saat pengembalian barang
  returnNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Kondisi barang sebelum dipinjam
  conditionBefore: {
    type: DataTypes.ENUM('good', 'broken'),
    allowNull: true
  },
  // Kondisi barang sesudah dipinjam/dikembalikan
  conditionAfter: {
    type: DataTypes.ENUM('good', 'broken'),
    allowNull: true
  },
  // Jumlah eskalasi notifikasi yang sudah dilakukan
  lastEscalation: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Waktu terakhir notifikasi dikirimkan
  lastNotificationAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'borrowings',
  freezeTableName: true,
  timestamps: true,
  indexes: [
    { fields: ['userId', 'status'] },
    { fields: ['itemId', 'status'] },
    { fields: ['expectedReturnDate'] }
  ]
});

// Menambahkan properti _id ke dalam output JSON untuk kompatibilitas
Borrowing.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = Borrowing;