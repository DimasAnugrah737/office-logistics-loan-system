const path = require('path');
const { Item } = require('../src/models/index');
const { sequelize } = require('../src/config/database');

async function checkItems() {
    try {
        const items = await Item.findAll();
        const conditions = {};
        console.log('--- Item Stock Check ---');
        items.forEach(item => {
            console.log(`ID: ${item.id} | Name: ${item.name} | Available: ${item.availableQuantity}/${item.quantity} | isAvailable: ${item.isAvailable} | Condition: ${item.condition}`);
            conditions[item.condition] = (conditions[item.condition] || 0) + 1;
        });
        console.log('------------------------');
        console.log('Distinct Conditions found:', conditions);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkItems();
