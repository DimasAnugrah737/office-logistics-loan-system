/**
 * Model Sequelize untuk tabel 'items' (Peralatan/Alat Kantor).
 * Mendefinisikan struktur barang, stok, kondisi, dan manajer yang bertanggung jawab.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Item = sequelize.define('Item', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  serialNumber: {
    type: DataTypes.STRING,
    unique: true
  },
  // Jumlah total barang yang dimiliki oleh kantor
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  // Jumlah barang yang saat ini tersedia untuk dipinjam (tidak sedang dipinjam/dipesan)
  availableQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  // Kondisi barang: Baik (good) atau Rusak (broken)
  condition: {
    type: DataTypes.ENUM('good', 'broken'),
    defaultValue: 'good'
  },
  location: {
    type: DataTypes.STRING
  },
  image: {
    type: DataTypes.STRING
  },
  // Kuantitas barang yang rusak dan tidak bisa dipinjam
  brokenQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  // Spesifikasi teknis tambahan dalam format JSON
  specifications: {
    type: DataTypes.JSON
  },
  // Status apakah barang aktif/bisa diedarkan
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  // ID User yang membuat entri barang ini
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // ID Petugas/Admin yang bertanggung jawab mengelola barang ini (biasanya berdasarkan lokasi/departemen)
  managedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'User ID dari petugas/admin yang mengelola barang ini'
  }
}, {
  tableName: 'items',
  freezeTableName: true,
  timestamps: true,
  // Paranoid: Mengaktifkan soft-delete (barang tidak benar-benar dihapus dari DB, hanya ditandai dihapus)
  paranoid: true
});

/**
 * Method prototype untuk menyesuaikan output JSON.
 * Menambahkan alias _id agar kompatibel dengan sistem yang mungkin mengharapkan format MongoDB.
 */
Item.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = Item;
