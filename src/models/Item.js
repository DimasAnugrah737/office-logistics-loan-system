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
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
  availableQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0
    }
  },
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
  specifications: {
    type: DataTypes.JSON
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdBy: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'items',
  freezeTableName: true,
  timestamps: true,
  paranoid: true
});

Item.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = Item;
