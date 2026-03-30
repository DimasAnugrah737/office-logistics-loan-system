const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

const getActivityLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { search, userId, action, startDate, endDate } = req.query;

    const { Op } = require('sequelize');
    const whereClause = {};

    if (userId && userId !== 'all') {
      whereClause.userId = userId;
    }

    if (action && action !== 'all' && action !== '') {
      const actionMap = {
        create: ['POST', 'create'],
        update: ['PUT', 'update'],
        delete: ['DELETE', 'delete'],
        borrow: ['borrow'],
        return: ['return'],
        approve: ['approve'],
        reject: ['reject'],
        login: ['login'],
        logout: ['logout']
      };

      const keywords = actionMap[action.toLowerCase()] || [action];
      whereClause.action = {
        [Op.or]: keywords.map(kw => ({ [Op.like]: `%${kw}%` }))
      };
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = end;
      }
    }

    const userWhere = {};
    if (search) {
      userWhere.fullName = { [Op.like]: `%${search}%` };
    }

    const { count, rows: logs } = await ActivityLog.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        as: 'user',
        attributes: ['fullName', 'email', 'role'],
        where: search ? userWhere : undefined,
        required: search ? true : false
      }],
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      logs,
      page,
      limit,
      total: count,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Get activity logs error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Clear old activity logs
// @route   DELETE /api/activity-logs/cleanup
// @access  Private/Admin
const cleanupLogs = async (req, res) => {
  try {
    const { days = 30, type = 'all' } = req.query;
    const { Op } = require('sequelize');

    let whereClause = {};

    // Default: delete logs older than X days
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - parseInt(days));
    whereClause.createdAt = { [Op.lt]: dateLimit };

    // Option to specifically delete "trash" (GET/ polling)
    if (type === 'trash') {
      whereClause = {
        [Op.or]: [
          { action: { [Op.like]: 'GET %' } },
          { action: { [Op.like]: '%notifications%' } },
          { action: { [Op.like]: '%auth/me%' } }
        ]
      };
    } else if (type === 'all_force') {
      whereClause = {}; // BE CAREFUL: This deletes everything
    }

    const deletedCount = await ActivityLog.destroy({ where: whereClause });

    res.json({
      message: `Successfully cleaned up ${deletedCount} logs.`,
      deletedCount
    });
  } catch (error) {
    console.error('Cleanup logs error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getActivityLogs,
  cleanupLogs
};