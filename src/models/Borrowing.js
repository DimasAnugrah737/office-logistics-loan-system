const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Borrowing = sequelize.define('Borrowing', {
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
  itemId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'items',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  borrowDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  expectedReturnDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  actualReturnDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  purpose: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'borrowed', 'returning', 'returned', 'cancelled', 'overdue'),
    defaultValue: 'pending'
  },
  approvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  returnApprovedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  returnApprovedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  penalty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  penaltyStatus: {
    type: DataTypes.ENUM('none', 'unpaid', 'paid'),
    defaultValue: 'none'
  },
  returnNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  conditionBefore: {
    type: DataTypes.ENUM('good', 'broken'),
    allowNull: true
  },
  conditionAfter: {
    type: DataTypes.ENUM('good', 'broken'),
    allowNull: true
  },
  lastEscalation: {
    type: DataTypes.INTEGER,
    defaultValue: 0
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

Borrowing.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = Borrowing;