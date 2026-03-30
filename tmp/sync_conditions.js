const Item = require('../src/models/Item');
const Borrowing = require('../src/models/Borrowing');
const { connectDB } = require('../src/config/database');
const { Op } = require('sequelize');

const syncConditions = async () => {
    try {
        await connectDB();
        console.log('Database connected.');

        // Update Items
        const [itemCount] = await Item.update(
            { condition: 'good' },
            {
                where: {
                    condition: { [Op.notIn]: ['good', 'broken'] }
                }
            }
        );
        console.log(`Updated ${itemCount} items to condition 'good'.`);

        // Update Borrowings conditionBefore
        const [borrowBeforeCount] = await Borrowing.update(
            { conditionBefore: 'good' },
            {
                where: {
                    conditionBefore: { [Op.notIn]: ['good', 'broken', null] }
                }
            }
        );
        console.log(`Updated ${borrowBeforeCount} borrowings (conditionBefore) to 'good'.`);

        // Update Borrowings conditionAfter
        const [borrowAfterCount] = await Borrowing.update(
            { conditionAfter: 'good' },
            {
                where: {
                    conditionAfter: { [Op.notIn]: ['good', 'broken', null] }
                }
            }
        );
        console.log(`Updated ${borrowAfterCount} borrowings (conditionAfter) to 'good'.`);

        process.exit(0);
    } catch (error) {
        console.error('Error syncing conditions:', error);
        process.exit(1);
    }
};

syncConditions();
