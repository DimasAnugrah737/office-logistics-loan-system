// Define all Sequelize model associations
// This file is loaded after all models are required to avoid circular dependencies

const User = require('./User');
const Category = require('./Category');
const Item = require('./Item');
const Borrowing = require('./Borrowing');
const Notification = require('./Notification');
const ActivityLog = require('./ActivityLog');

const setupAssociations = () => {
  // User associations
  User.hasMany(Category, { foreignKey: 'createdBy', as: 'categoriesCreated', onDelete: 'CASCADE' });
  User.hasMany(Item, { foreignKey: 'createdBy', as: 'itemsCreated', onDelete: 'CASCADE' });
  User.hasMany(Borrowing, { foreignKey: 'userId', as: 'borrowings', onDelete: 'CASCADE' });
  User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
  User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activities', onDelete: 'CASCADE' });

  // Category associations
  Category.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
  Category.hasMany(Item, { foreignKey: 'categoryId', as: 'items' });

  // Item associations
  Item.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
  Item.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
  Item.hasMany(Borrowing, { foreignKey: 'itemId', as: 'borrowings' });

  // Borrowing associations
  Borrowing.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Borrowing.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
  Borrowing.belongsTo(User, { foreignKey: 'approvedBy', as: 'approverUser', onDelete: 'SET NULL' });
  Borrowing.belongsTo(User, { foreignKey: 'returnApprovedBy', as: 'returnApproverUser', onDelete: 'SET NULL' });
  Borrowing.hasMany(Notification, { foreignKey: 'relatedBorrowingId', as: 'notifications' });

  // Notification associations
  Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Notification.belongsTo(Borrowing, { foreignKey: 'relatedBorrowingId', as: 'borrowing' });

  // ActivityLog associations
  ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
};

module.exports = setupAssociations;
