const { sequelize } = require('../src/config/database');
const { Item, Borrowing, User, Category, Notification, ActivityLog } = require('../src/models');
const setupAssociations = require('../src/models/associations');
const { Op } = require('sequelize');

async function dropBmwData() {
  try {
    console.log('--- Mencari data BMW M3 ---');
    
    setupAssociations();

    const items = await Item.findAll({
      where: { name: { [Op.like]: '%BMW M3%' } },
      paranoid: false
    });

    if (items.length === 0) {
      console.log('Tidak ditemukan item BMW M3.');
      process.exit(0);
    }

    const itemIds = items.map(i => i.id);
    console.log(`Ditemukan ${items.length} item:`, items.map(i => `${i.name} (ID: ${i.id})`).join(', '));

    // 2. Cari Borrowings terkait (termasuk yang sudah dihapus)
    const borrowings = await Borrowing.findAll({
      where: { itemId: { [Op.in]: itemIds } },
      paranoid: false
    });
    const borrowingIds = borrowings.map(b => b.id);
    console.log(`Ditemukan ${borrowings.length} data peminjaman terkait.`);

    // 3. Hapus Notifications terkait
    const deletedNotifs = await Notification.destroy({
      where: {
        [Op.or]: [
          { message: { [Op.like]: '%BMW%' } },
          { relatedBorrowingId: { [Op.in]: borrowingIds } }
        ]
      },
      force: true
    });
    console.log(`Dihapus ${deletedNotifs} notifikasi secara permanen.`);

    // 4. Hapus ActivityLogs terkait
    const deletedLogs = await ActivityLog.destroy({
      where: {
        [Op.or]: [
          { 
            entityType: 'item',
            entityId: { [Op.in]: itemIds }
          },
          {
            entityType: 'borrowing',
            entityId: { [Op.in]: borrowingIds }
          }
        ]
      }
    });
    console.log(`Dihapus ${deletedLogs} log aktivitas secara permanen.`);

    // 5. Hapus Borrowings (HARD DELETE)
    if (borrowingIds.length > 0) {
      await Borrowing.destroy({
        where: { id: { [Op.in]: borrowingIds } },
        force: true
      });
      console.log(`Dihapus ${borrowings.length} data peminjaman secara permanen.`);
    }

    // 6. Akhirnya hapus Item (HARD DELETE)
    await Item.destroy({
      where: { id: { [Op.in]: itemIds } },
      force: true
    });
    console.log(`Dihapus ${items.length} data item BMW M3 secara permanen.`);

    console.log('--- Operasi SELESAI ---');
    process.exit(0);
  } catch (error) {
    console.error('Terjadi kesalahan:', error.message);
    process.exit(1);
  }
}

dropBmwData();
