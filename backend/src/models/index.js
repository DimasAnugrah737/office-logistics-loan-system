const User = require('./User');
const Category = require('./Category');
const Item = require('./Item');
const Borrowing = require('./Borrowing');
const Notification = require('./Notification');
const ActivityLog = require('./ActivityLog');

// RELATION CATEGORY ↔ ITEM
// Associations are now handled in associations.js helper

module.exports = {
  User,
  Category,
  Item,
  Borrowing,
  Notification,
  ActivityLog
};
