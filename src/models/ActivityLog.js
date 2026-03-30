const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  entityType: {
    type: DataTypes.ENUM('user', 'item', 'category', 'borrowing', 'return', 'system'),
    allowNull: true
  },
  entityId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'activitylogs',
  freezeTableName: true,
  timestamps: true,
  hooks: {
    afterCreate: async (log, options) => {
      try {
        const socket = require('../utils/socket');
        const User = require('./User');

        // Fetch user data for the log to match the frontend expectations
        const logWithUser = await ActivityLog.findByPk(log.id, {
          include: [{
            model: User,
            as: 'user',
            attributes: ['fullName', 'email', 'role']
          }]
        });

        if (logWithUser) {
          socket.emitToAll('activity:created', logWithUser);
        }
      } catch (error) {
        console.error('Socket emission error in ActivityLog hook:', error);
      }
    }
  }
});

ActivityLog.prototype.toJSON = function () {
  const values = Object.assign({}, this.get());
  values._id = values.id;
  return values;
};

module.exports = ActivityLog;