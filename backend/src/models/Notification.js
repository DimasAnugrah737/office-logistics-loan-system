const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('borrow_request', 'borrow_approved', 'borrow_rejected', 'return_request', 'return_approved', 'overdue_warning', 'system'),
    defaultValue: 'system'
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  relatedBorrowingId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'borrowings',
      key: 'id'
    }
  }
}, {
  tableName: 'notifications',
  freezeTableName: true,
  timestamps: true
});

Notification.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = Notification;
