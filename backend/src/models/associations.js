// Mendefinisikan semua asosiasi model Sequelize
// File ini dimuat setelah semua model di-require untuk menghindari ketergantungan melingkar (circular dependencies)

const User = require('./User');
const Category = require('./Category');
const Item = require('./Item');
const Borrowing = require('./Borrowing');
const Notification = require('./Notification');
const ActivityLog = require('./ActivityLog');

const setupAssociations = () => {
  // Relasi Pengguna (User)
  User.hasMany(Category, { foreignKey: 'createdBy', as: 'categoriesCreated', onDelete: 'CASCADE' });
  User.hasMany(Item, { foreignKey: 'createdBy', as: 'itemsCreated', onDelete: 'CASCADE' });
  User.hasMany(Borrowing, { foreignKey: 'userId', as: 'borrowings', onDelete: 'CASCADE' });
  User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications', onDelete: 'CASCADE' });
  User.hasMany(ActivityLog, { foreignKey: 'userId', as: 'activities', onDelete: 'CASCADE' });

  // Relasi Kategori (Category)
  Category.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
  Category.hasMany(Item, { foreignKey: 'categoryId', as: 'items' });

  // Relasi Barang (Item)
  Item.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
  Item.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
  Item.belongsTo(User, { foreignKey: 'managedBy', as: 'manager' });
  Item.hasMany(Borrowing, { foreignKey: 'itemId', as: 'borrowings' });

  // Relasi Peminjaman (Borrowing)
  Borrowing.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Borrowing.belongsTo(Item, { foreignKey: 'itemId', as: 'item' });
  Borrowing.belongsTo(User, { foreignKey: 'approvedBy', as: 'approverUser', onDelete: 'SET NULL' });
  Borrowing.belongsTo(User, { foreignKey: 'returnApprovedBy', as: 'returnApproverUser', onDelete: 'SET NULL' });
  Borrowing.hasMany(Notification, { foreignKey: 'relatedBorrowingId', as: 'notifications' });


  // Relasi Notifikasi (Notification)
  Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  Notification.belongsTo(Borrowing, { foreignKey: 'relatedBorrowingId', as: 'borrowing' });

  // Relasi Log Aktivitas (ActivityLog)
  ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
};

module.exports = setupAssociations;
