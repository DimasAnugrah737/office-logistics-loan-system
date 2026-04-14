const { sequelize } = require('../src/config/database');
const { Item, Borrowing, User, Category, Notification, ActivityLog } = require('../src/models');
const setupAssociations = require('../src/models/associations');
const { Op } = require('sequelize');

async function inspect() {
  setupAssociations(); 
  
  const items = await Item.findAll({
    where: { name: { [Op.like]: '%BMW%' } },
    paranoid: false
  });
  console.log('--- BMW ITEMS (including deleted) ---');
  console.log(items.map(i => `${i.id}: ${i.name} (Deleted: ${!!i.deletedAt})`).join('\n'));

  const borrowings = await Borrowing.findAll({
    include: [{ model: Item, as: 'item', paranoid: false }],
    where: {
      [Op.or]: [
        { '$item.name$': { [Op.like]: '%BMW%' } },
        { purpose: { [Op.like]: '%BMW%' } }
      ]
    },
    paranoid: false
  });
  console.log('--- BMW BORROWINGS ---');
  console.log(borrowings.map(b => `${b.id}: ItemID ${b.itemId} (${b.item?.name || 'NO ITEM'})`).join('\n'));
  process.exit(0);
}

inspect();
