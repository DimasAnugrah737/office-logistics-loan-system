const Borrowing = require('../models/Borrowing');
const Item = require('../models/Item');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Category = require('../models/Category');
const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');
const { emitToUser, emitToAll } = require('../utils/socket');

// @desc    Create new borrowing request
// @route   POST /api/borrowings
// @access  Private
const createBorrowing = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { itemId, quantity, borrowDate, expectedReturnDate, purpose } = req.body;

    // 0. Check if user is blocked from borrowing
    // Check for explicit block
    if (req.user.isBlockedFromBorrowing) {
      await t.rollback();
      return res.status(403).json({
        message: `Borrowing suspended: ${req.user.blockReason || 'You have overdue items that must be returned.'}`,
        isBlocked: true
      });
    }

    // Double check for unpaid penalties even if not explicitly blocked
    const unpaidPenalty = await Borrowing.count({
      where: {
        userId: req.user.id,
        penaltyStatus: 'unpaid',
        penalty: { [Op.gt]: 0 }
      },
      transaction: t
    });

    if (unpaidPenalty > 0) {
      await t.rollback();
      return res.status(403).json({
        message: 'Borrowing suspended: You have unpaid damage penalties.',
        isBlocked: true
      });
    }

    // 1. Validate if item exists and is available
    const item = await Item.findByPk(itemId, {
      include: [{ model: Category, as: 'category' }],
      transaction: t
    });
    if (!item) {
      await t.rollback();
      return res.status(404).json({ message: 'Item not found' });
    }

    if (!item.isAvailable || item.availableQuantity < quantity) {
      await t.rollback();
      return res.status(400).json({
        message: `Only ${item.availableQuantity} items available for borrowing`
      });
    }

    // 2. Create the borrowing record
    const borrowing = await Borrowing.create({
      userId: req.user.id,
      itemId,
      quantity,
      borrowDate: borrowDate || new Date(),
      expectedReturnDate,
      purpose,
      status: 'pending'
    }, { transaction: t });

    // 3. Update item available quantity (RESERVE STOCK ON CREATE)
    await item.update({
      availableQuantity: item.availableQuantity - quantity
    }, { transaction: t });

    // 4. Notify Officers (ONLY those in the same location/department as the item)
    const officers = await User.findAll({
      where: {
        role: 'officer',
        department: item.category?.managingDepartment || '' // Only notify officers responsible for this category
      },
      transaction: t
    });

    const notifications = officers.map(officer => ({
      userId: officer.id,
      title: 'New Borrowing Request',
      message: `${req.user.fullName} requested to borrow ${quantity}x ${item.name}`,
      type: 'borrow_request',
      path: `/borrowings?search=${borrowing.id}`,
      relatedBorrowingId: borrowing.id
    }));

    await Notification.bulkCreate(notifications, { transaction: t });

    // 5. Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Requested to borrow ${item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { quantity, expectedReturnDate, reservedFrom: item.availableQuantity + quantity, remaining: item.availableQuantity - quantity }
    }, { transaction: t });

    // Broadcast update (reload item with category for frontend)
    const itemWithCategory = await Item.findByPk(itemId, {
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      transaction: t
    });

    // REAL-TIME: Notify Officers immediately
    const createdNotifications = await Notification.findAll({
      where: { relatedBorrowingId: borrowing.id, type: 'borrow_request' },
      transaction: t
    });

    await t.commit();

    emitToAll('item:updated', itemWithCategory);
    emitToAll('borrowing:created', { borrowingId: borrowing.id });

    createdNotifications.forEach(notif => {
      emitToUser(notif.userId, 'notification', {
        _id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        path: notif.path,
        relatedBorrowingId: notif.relatedBorrowingId,
        createdAt: notif.createdAt
      });
    });

    res.status(201).json(borrowing);
  } catch (error) {
    if (t) await t.rollback();
    console.error('Create borrowing error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all borrowings (Admin/Officer gets all, User gets only their own)
// @route   GET /api/borrowings
// @access  Private
const getBorrowings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, searchUser, searchItem, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    // If user is an officer, only show borrowings for items in their department/location
    if (req.user.role === 'officer') {
      // We must filter by Item's location matching User's department
      // Since we are using an include, we add the where clause inside the Item include later
    }

    // If user is a regular user, only show their own borrowings
    if (req.user.role === 'user') {
      whereClause.userId = req.user.id;
    }

    if (status) {
      whereClause.status = status;
    }

    // Support search by ID (for notification clicks)
    if (search && !isNaN(search)) {
      whereClause.id = search;
    }

    const { count, rows: borrowings } = await Borrowing.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'nip', 'department', 'isBlockedFromBorrowing'],
          where: searchUser ? { fullName: { [Op.like]: `%${searchUser}%` } } : undefined
        },
        {
          model: Item,
          as: 'item',
          attributes: ['id', 'name', 'image', 'location', 'description'],
          include: [{
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'managingDepartment'],
            where: req.user.role === 'officer' ? {
              managingDepartment: req.user.department
            } : undefined,
            required: req.user.role === 'officer'
          }],
          where: {
            ...(searchItem ? { name: { [Op.like]: `%${searchItem}%` } } : {})
          }
        },
        { model: User, as: 'approverUser', attributes: ['id', 'fullName'] }
      ],
      attributes: ['id', 'userId', 'itemId', 'quantity', 'borrowDate', 'expectedReturnDate', 'status', 'penalty', 'purpose', 'notes', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit) || 10,
      offset: parseInt(offset) || 0,
      distinct: true // Required for correct count with includes
    });

    res.json({
      borrowings,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get borrowings error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get borrowing by ID
// @route   GET /api/borrowings/:id
// @access  Private
const getBorrowingById = async (req, res) => {
  try {
    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'fullName', 'nip', 'email', 'department', 'position', 'phone'] },
        { 
          model: Item, 
          as: 'item', 
          attributes: ['id', 'name', 'image', 'location', 'availableQuantity', 'quantity'],
          include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'managingDepartment'] }] 
        },
        { model: User, as: 'approverUser', attributes: ['id', 'fullName'] }
      ]
    });

    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing request not found' });
    }

    // Check permissions
    if (req.user.role === 'user' && borrowing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      return res.status(403).json({ message: 'Not authorized for this department' });
    }

    res.json(borrowing);
  } catch (error) {
    console.error('Get borrowing error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Approve borrowing request
// @route   PUT /api/borrowings/:id/approve
// @access  Private/Admin/Officer
const approveBorrowing = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { notes } = req.body;

    // Role Check: Only Officer or Admin can approve
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only officers or admins are allowed to approve borrowing requests' });
    }

    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Category, as: 'category' }]
      }],
      transaction: t
    });

    if (!borrowing) {
      await t.rollback();
      return res.status(404).json({ message: 'Borrowing request not found' });
    }

    // Category/Department Check for Officers
    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      await t.rollback();
      return res.status(403).json({ message: `Access denied: You are only authorized to manage items in the ${req.user.department} department.` });
    }

    if (borrowing.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ message: `Cannot approve request with status: ${borrowing.status}` });
    }

    // Check item availability again
    if (borrowing.item.availableQuantity < borrowing.quantity) {
      await t.rollback();
      return res.status(400).json({ message: 'Item is no longer available in the requested quantity' });
    }

    // Update borrowing status
    await borrowing.update({
      status: 'approved',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      notes: notes || borrowing.notes
    }, { transaction: t });

    // STOCK WAS RESERVED ON CREATE, SO NO NEED TO SUBTRACT AGAIN HERE


    // Notify user
    const userNotif = await Notification.create({
      userId: borrowing.userId,
      title: 'Borrowing Approved',
      message: `Your request to borrow ${borrowing.item.name} has been approved.`,
      type: 'borrow_approved',
      path: `/my-borrowings?search=${borrowing.id}`,
      relatedBorrowingId: borrowing.id
    }, { transaction: t });

    // Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Approved borrowing request for ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { requesterId: borrowing.userId }
    }, { transaction: t });

    // REAL-TIME: Auto-reject other pending requests if quantity insufficient
    const remainingQty = borrowing.item.availableQuantity;
    const competingRequests = await Borrowing.findAll({
      where: {
        itemId: borrowing.itemId,
        status: 'pending',
        id: { [Op.ne]: borrowing.id },
        quantity: { [Op.gt]: remainingQty }
      },
      transaction: t
    });

    const rejectNotifs = [];
    for (const req_to_reject of competingRequests) {
      await req_to_reject.update({
        status: 'rejected',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        notes: 'Automatically rejected due to insufficient stock.'
      }, { transaction: t });

      // Notify competing user
      const rNotif = await Notification.create({
        userId: req_to_reject.userId,
        title: 'Borrowing Auto-Rejected',
        message: `Your request for ${borrowing.item.name} was automatically rejected due to insufficient stock.`,
        type: 'borrow_rejected',
        path: `/my-borrowings?search=${req_to_reject.id}`,
        relatedBorrowingId: req_to_reject.id
      }, { transaction: t });
      rejectNotifs.push(rNotif);
    }

    await t.commit();

    // REAL-TIME: Emit events AFTER commit to ensure data is available
    rejectNotifs.forEach(notif => {
      emitToUser(notif.userId, 'notification', {
        _id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        path: notif.path,
        relatedBorrowingId: notif.relatedBorrowingId,
        createdAt: notif.createdAt
      });
    });

    emitToUser(userNotif.userId, 'notification', {
      _id: userNotif.id,
      title: userNotif.title,
      message: userNotif.message,
      type: userNotif.type,
      path: userNotif.path,
      relatedBorrowingId: userNotif.relatedBorrowingId,
      createdAt: userNotif.createdAt
    });

    emitToAll('borrowing:approved', { borrowingId: borrowing.id });

    res.json({ message: 'Borrowing request approved', borrowing });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Approve borrowing error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Reject borrowing request
// @route   PUT /api/borrowings/:id/reject
// @access  Private/Admin/Officer
const rejectBorrowing = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { reason, notes } = req.body; // frontend sends 'reason' in some places, 'notes' in others

    // Role Check: Only Officer or Admin can reject
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only officers or admins are allowed to reject borrowing requests' });
    }

    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Category, as: 'category' }]
      }],
      transaction: t
    });

    if (!borrowing) {
      await t.rollback();
      return res.status(404).json({ message: 'Borrowing request not found' });
    }

    // Category/Department Check for Officers
    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      await t.rollback();
      return res.status(403).json({ message: `Access denied: You are only authorized to manage items in the ${req.user.department} department.` });
    }

    if (borrowing.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ message: 'Can only reject pending requests' });
    }

    const rejectionReason = reason || notes || 'No reason provided';

    await borrowing.update({
      status: 'rejected',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      notes: rejectionReason
    }, { transaction: t });

    // Restore item stock (Return reserved quantity)
    await borrowing.item.update({
      availableQuantity: borrowing.item.availableQuantity + borrowing.quantity
    }, { transaction: t });

    // Notify user
    const userNotif = await Notification.create({
      userId: borrowing.userId,
      title: 'Borrowing Rejected',
      message: `Your request to borrow ${borrowing.item.name} was rejected. Reason: ${rejectionReason}`,
      type: 'borrow_rejected',
      path: `/my-borrowings?search=${borrowing.id}`,
      relatedBorrowingId: borrowing.id
    }, { transaction: t });

    // Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Rejected borrowing request for ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { reason: rejectionReason }
    }, { transaction: t });

    await t.commit();

    // REAL-TIME: Emit events AFTER commit
    emitToUser(userNotif.userId, 'notification', {
      _id: userNotif.id,
      title: userNotif.title,
      message: userNotif.message,
      type: userNotif.type,
      path: userNotif.path,
      relatedBorrowingId: userNotif.relatedBorrowingId,
      createdAt: userNotif.createdAt
    });

    emitToAll('borrowing:rejected', { borrowingId: borrowing.id });

    res.json({ message: 'Borrowing request rejected', borrowing });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Reject borrowing error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// @desc    Mark items as picked up/borrowed
// @route   PUT /api/borrowings/:id/borrow
// @access  Private/Admin/Officer
const markAsBorrowed = async (req, res) => {
  try {
    const { conditionBefore, notes } = req.body;
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only officers or admins are allowed to mark items as borrowed' });
    }

    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Category, as: 'category' }]
      }]
    });

    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing request not found' });
    }

    // Category/Department Check for Officers
    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      return res.status(403).json({ message: `Access denied: You are only authorized to manage items in the ${req.user.department} department.` });
    }

    if (borrowing.status !== 'approved') {
      return res.status(400).json({ message: 'Request must be approved before marking as borrowed' });
    }

    await borrowing.update({
      status: 'borrowed',
      borrowDate: new Date(),
      conditionBefore: conditionBefore || 'good',
      notes: notes || borrowing.notes
    });

    // Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Marked item as borrowed: ${borrowing.id}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { conditionBefore }
    });

    // Broadcast to all users
    emitToAll('borrowing:borrowed', { borrowingId: borrowing.id });

    res.json({ message: 'Item marked as borrowed', borrowing });
  } catch (error) {
    console.error('Mark as borrowed error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Request to return items
// @route   PUT /api/borrowings/:id/return-request
// @access  Private
const requestReturn = async (req, res) => {
  try {
    const { conditionAfter, notes } = req.body;
    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Category, as: 'category' }]
      }]
    });

    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing record not found' });
    }

    if (borrowing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (borrowing.status !== 'borrowed' && borrowing.status !== 'overdue') {
      return res.status(400).json({ message: 'Can only request return for borrowed or overdue items' });
    }

    await borrowing.update({
      status: 'returning',
      conditionAfter: conditionAfter || 'good',
      notes: notes || borrowing.notes
    });

    // Notify Admins and RELEVANT Officers (those matching the item location)
    const officials = await User.findAll({
      where: {
        [Op.or]: [
          { role: 'admin' },
          {
            role: 'officer',
            department: borrowing.item?.category?.managingDepartment || '' // Only notify officers responsible for this category
          }
        ]
      }
    });
    const notifications = officials.map(o => ({
      userId: o.id,
      title: 'Return Request',
      message: `${req.user.fullName} is returning ${borrowing.quantity}x items.`,
      type: 'return_request',
      path: `/borrowings?search=${borrowing.id}`,
      relatedBorrowingId: borrowing.id
    }));
    await Notification.bulkCreate(notifications);

    // Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Requested return for borrowing: ${borrowing.id}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { conditionAfter }
    });

    // Broadcast to all users (update lists)
    emitToAll('borrowing:returned', { borrowingId: borrowing.id });

    const createdNotifications = await Notification.findAll({
      where: { relatedBorrowingId: borrowing.id, type: 'return_request' }
    });

    // REAL-TIME: Notify Officials immediately
    createdNotifications.forEach(notif => {
      emitToUser(notif.userId, 'notification', {
        _id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        path: notif.path,
        relatedBorrowingId: notif.relatedBorrowingId,
        createdAt: notif.createdAt
      });
    });

    res.json({ message: 'Return request submitted', borrowing });
  } catch (error) {
    console.error('Request return error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Approve return and update stock
// @route   PUT /api/borrowings/:id/approve-return
// @access  Private/Admin/Officer
const approveReturn = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only officers or admins are allowed to approve returns' });
    }

    const { conditionAfter, notes, penalty, penaltyStatus } = req.body;

    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Category, as: 'category' }]
      }],
      transaction: t
    });

    if (!borrowing) {
      await t.rollback();
      return res.status(404).json({ message: 'Borrowing record not found' });
    }

    // Category/Department Check for Officers
    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      await t.rollback();
      return res.status(403).json({ message: `Access denied: You are only authorized to manage items in the ${req.user.department} department.` });
    }

    if (borrowing.status !== 'returning') {
      await t.rollback();
      return res.status(400).json({ message: 'Item must be in returning state to approve return' });
    }

    if (borrowing.returnApprovedAt) {
      await t.rollback();
      return res.status(400).json({ message: 'Return has already been approved' });
    }

    const updateData = {
      status: 'returned',
      actualReturnDate: new Date(),
      returnApprovedBy: req.user.id,
      returnApprovedAt: new Date(),
      conditionAfter: conditionAfter || 'good',
      notes: notes || borrowing.notes
    };

    if (conditionAfter === 'broken' && penalty !== undefined) {
      updateData.penalty = penalty;
      updateData.penaltyStatus = penaltyStatus || 'unpaid';
    }

    // Update borrowing
    await borrowing.update(updateData, { transaction: t });

    const borrowingUser = await User.findByPk(borrowing.userId, { transaction: t });

    // Handle blocking for penalty or overdue
    if (updateData.penalty > 0 && updateData.penaltyStatus === 'unpaid') {
      // Always block if there's an unpaid penalty for damage
      if (borrowingUser) {
        await borrowingUser.update({
          isBlockedFromBorrowing: true,
          blockReason: `Unpaid damage penalty for item: ${borrowing.item.name}.`
        }, { transaction: t });
      }

      // Specific Notification for Penalty
      await Notification.create({
        userId: borrowing.userId,
        title: '⚠️ Damage Penalty',
        message: `Return of ${borrowing.item.name} completed with a penalty of Rp ${Number(updateData.penalty).toLocaleString('en-US')} due to damage. Account suspended until paid.`,
        type: 'overdue_warning',
        path: `/my-borrowings?search=${borrowing.id}`,
        relatedBorrowingId: borrowing.id
      }, { transaction: t });
    } else {
      // Standard notification
      await Notification.create({
        userId: borrowing.userId,
        title: 'Return Approved',
        message: `Your return of ${borrowing.item.name} has been approved.`,
        type: 'return_approved',
        path: `/my-borrowings?search=${borrowing.id}`,
        relatedBorrowingId: borrowing.id
      }, { transaction: t });

      // Only unblock if no other overdue items AND no other unpaid penalties
      const otherOverdue = await Borrowing.count({
        where: {
          userId: borrowing.userId,
          status: { [Op.in]: ['borrowed', 'overdue'] },
          expectedReturnDate: { [Op.lt]: new Date() }
        },
        transaction: t
      });

      const otherUnpaidPenalties = await Borrowing.count({
        where: {
          userId: borrowing.userId,
          penaltyStatus: 'unpaid',
          penalty: { [Op.gt]: 0 },
          id: { [Op.ne]: borrowing.id }
        },
        transaction: t
      });

      if (otherOverdue === 0 && otherUnpaidPenalties === 0) {
        if (borrowingUser && borrowingUser.isBlockedFromBorrowing) {
          await borrowingUser.update({
            isBlockedFromBorrowing: false,
            blockReason: null
          }, { transaction: t });
        }
      }
    }

    // RESTORE STOCK & UPDATE CONDITION (WITH SPLITTING LOGIC)
    const originalItem = borrowing.item;
    const returnedQty = borrowing.quantity;
    const newCondition = conditionAfter || originalItem.condition;

    // If condition is different AND item is part of a larger batch, split it
    if (newCondition !== originalItem.condition && originalItem.quantity > returnedQty) {
      // 1. Decrease original batch quantity
      await originalItem.update({
        quantity: originalItem.quantity - returnedQty
        // No change to availableQuantity here because it was already subtracted when borrowed.
        // It remains as the stock of the "remaining" good items.
      }, { transaction: t });

      // 2. Find or create an item record for the new condition
      let splitItem = await Item.findOne({
        where: {
          name: originalItem.name,
          categoryId: originalItem.categoryId,
          condition: newCondition
        },
        transaction: t
      });

      if (splitItem) {
        await splitItem.update({
          quantity: splitItem.quantity + returnedQty,
          availableQuantity: splitItem.availableQuantity + returnedQty
        }, { transaction: t });
      } else {
        await Item.create({
          name: originalItem.name,
          description: originalItem.description,
          categoryId: originalItem.categoryId,
          quantity: returnedQty,
          availableQuantity: returnedQty,
          condition: newCondition,
          location: originalItem.location,
          image: originalItem.image,
          specifications: originalItem.specifications,
          createdBy: req.user.id,
          isAvailable: newCondition !== 'broken' // Auto-disable broken items from circulation
        }, { transaction: t });
      }
    } else {
      // Standard return: Update condition for the entire batch (or it's a single item)
      await originalItem.update({
        availableQuantity: originalItem.availableQuantity + returnedQty,
        condition: newCondition,
        isAvailable: newCondition !== 'broken' ? originalItem.isAvailable : false
      }, { transaction: t });
    }

    // Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Approved return for ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: {
        conditionAfter: conditionAfter || 'good',
        notes: notes,
        penalty: updateData.penalty
      }
    }, { transaction: t });

    // Notify User
    let userNotif;
    if (updateData.penalty > 0 && updateData.penaltyStatus === 'unpaid') {
      userNotif = await Notification.create({
        userId: borrowing.userId,
        title: '⚠️ Damage Penalty',
        message: `Return of ${borrowing.item.name} completed with a penalty. Account suspended.`,
        type: 'overdue_warning',
        path: `/my-borrowings?search=${borrowing.id}`,
        relatedBorrowingId: borrowing.id
      }, { transaction: t });
    } else {
      userNotif = await Notification.create({
        userId: borrowing.userId,
        title: 'Return Approved',
        message: `Your return of ${borrowing.item.name} has been approved.`,
        type: 'return_approved',
        path: `/my-borrowings?search=${borrowing.id}`,
        relatedBorrowingId: borrowing.id
      }, { transaction: t });
    }

    await t.commit();

    // REAL-TIME: Emit events AFTER commit
    emitToUser(userNotif.userId, 'notification', {
      _id: userNotif.id,
      title: userNotif.title,
      message: userNotif.message,
      type: userNotif.type,
      path: userNotif.path,
      relatedBorrowingId: userNotif.relatedBorrowingId,
      createdAt: userNotif.createdAt
    });

    emitToAll('borrowing:return_approved', { borrowingId: borrowing.id });

    res.json({ message: 'Return approved and stock updated', borrowing });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Approve return error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Check and alert for overdue borrowings
const checkOverdueBorrowings = async () => {
  try {
    const list = await Borrowing.findAll({
      where: {
        status: { [Op.in]: ['borrowed', 'approved', 'returning', 'overdue'] }
      },
      include: [
        {
          model: Item,
          as: 'item',
          include: [{ model: Category, as: 'category' }]
        },
        { model: User, as: 'user' }
      ]
    });

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const borrowing of list) {
      const dueDate = new Date(borrowing.expectedReturnDate);
      dueDate.setHours(0, 0, 0, 0);

      // Diff in days (rounded)
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let level = 0;
      let title = '';
      let message = '';
      let type = 'system';
      let shouldBlock = false;
      let shouldMarkOverdue = false;

      // Level 1: H-1
      if (diffDays === -1) {
        level = 1;
        title = '⏳ Return Reminder: Tomorrow';
        message = `Borrowing of ${borrowing.item?.name} is scheduled for return tomorrow. Please prepare the equipment.`;
      }
      // Level 2: Hari H
      else if (diffDays === 0) {
        level = 2;
        title = '📅 Batas Waktu Pengembalian';
        message = `Batas waktu pengembalian ${borrowing.item?.name} adalah hari ini. Harap segera kembalikan barang ke petugas.`;
      }
      // Level 3: Overdue (H+1 or more)
      else if (diffDays >= 1) {
        level = 3;
        title = '⚠️ Peringatan Keterlambatan';
        message = `Pengembalian ${borrowing.item?.name} sudah terlambat ${diffDays} hari. Status telah diubah menjadi Terlambat. Harap segera kembalikan!`;
        shouldMarkOverdue = true;
      }
      // Level 4: H+2 (Block User)
      if (diffDays >= 2) {
        level = 4;
        title = '🚫 Akun Ditangguhkan';
        message = `Peminjaman ${borrowing.item?.name} telah terlambat ${diffDays} hari. Akses peminjaman baru dinonaktifkan sementara.`;
        shouldBlock = true;
      }
      // Level 5: > H+4 (Escalation)
      if (diffDays > 4) {
        level = 5;
        title = '🛑 Peringatan Kritis';
        message = `Peminjaman ${borrowing.item?.name} telah terlambat lebih dari 4 hari. Laporan ini telah diteruskan ke Supervisor/Departemen terkait.`;
      }

      // Update record if escalation level increased OR status needs to change to overdue
      const statusNeedsUpdate = shouldMarkOverdue && borrowing.status !== 'overdue';
      
      if (level > borrowing.lastEscalation || statusNeedsUpdate || (level === 5 && now.getDate() % 2 === 0)) {
        try {
          const userNotif = await Notification.create({
            userId: borrowing.userId,
            title,
            message,
            type: 'overdue_warning',
            path: `/my-borrowings?search=${borrowing.id}`,
            relatedBorrowingId: borrowing.id
          });

          // Update borrowing escalation state and status
          const updateData = { lastEscalation: level };
          if (shouldMarkOverdue && borrowing.status !== 'overdue') {
            updateData.status = 'overdue';
          }

          await borrowing.update(updateData);

          // Block User if needed
          if (shouldBlock && !borrowing.user?.isBlockedFromBorrowing) {
            await borrowing.user?.update({
              isBlockedFromBorrowing: true,
              blockReason: `Terlambat mengembalikan ${borrowing.item?.name} selama ${diffDays} hari.`
            });
          }

          // Emit Socket to user
          emitToUser(userNotif.userId, 'notification', {
            _id: userNotif.id,
            title: userNotif.title,
            message: userNotif.message,
            type: userNotif.type,
            path: userNotif.path,
            relatedBorrowingId: userNotif.relatedBorrowingId,
            createdAt: userNotif.createdAt
          });

          // Notify Officers if Overdue (Level >= 3)
          if (level >= 3) {
            const officers = await User.findAll({
              where: {
                role: 'officer',
                department: borrowing.item?.category?.managingDepartment || ''
              }
            });
            for (const officer of officers) {
              const officerNotif = await Notification.create({
                userId: officer.id,
                title: `Laporan Keterlambatan: ${borrowing.user?.fullName}`,
                message: `${borrowing.user?.fullName} belum mengembalikan ${borrowing.item?.name} (Terlambat ${diffDays} hari).`,
                type: 'system',
                path: `/borrowings?search=${borrowing.id}`,
                relatedBorrowingId: borrowing.id
              });
              emitToUser(officerNotif.userId, 'notification', {
                _id: officerNotif.id,
                title: officerNotif.title,
                message: officerNotif.message,
                type: officerNotif.type,
                path: officerNotif.path,
                relatedBorrowingId: officerNotif.relatedBorrowingId,
                createdAt: officerNotif.createdAt
              });
            }
          }
        } catch (updateError) {
          console.error(`Failed to update overdue status for borrowing ${borrowing.id}:`, updateError.message);
        }
      }
    }
  } catch (error) {
    console.error('Overdue check error:', error.message);
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/borrowings/stats/dashboard
// @access  Private/Admin/Officer
const getDashboardStats = async (req, res) => {
  try {
    // 1. Run overdue check (silent failure)
    try {
      await checkOverdueBorrowings();
    } catch (overdueError) {
      console.error('Overdue check error in dashboard:', overdueError.message);
    }

    // 2. Fetch all required counts in parallel for performance
    const isOfficer = req.user.role === 'officer';
    const dept = req.user.department;

    const [
      totalItems,
      totalUsers,
      totalBorrowings,
      totalUnpaidPenalties,
      statusGrouped
    ] = await Promise.all([
      Item.count({
        include: isOfficer ? [{
          model: Category,
          as: 'category',
          where: { managingDepartment: dept }
        }] : []
      }),
      User.count({ where: { role: { [Op.ne]: 'admin' } } }),
      Borrowing.count({
        include: isOfficer ? [{
          model: Item,
          as: 'item',
          required: true,
          include: [{
            model: Category,
            as: 'category',
            where: { managingDepartment: dept }
          }]
        }] : []
      }),
      Borrowing.sum('penalty', {
        where: { penaltyStatus: 'unpaid' },
        include: isOfficer ? [{
          model: Item,
          as: 'item',
          required: true,
          include: [{
            model: Category,
            as: 'category',
            where: { managingDepartment: dept }
          }]
        }] : []
      }),
      Borrowing.findAll({
        attributes: [
          'status',
          [Sequelize.fn('COUNT', Sequelize.col('Borrowing.id')), 'count']
        ],
        include: isOfficer ? [{
          model: Item,
          as: 'item',
          required: true,
          attributes: [],
          include: [{
            model: Category,
            as: 'category',
            required: true,
            attributes: [],
            where: { managingDepartment: dept }
          }]
        }] : [],
        group: ['status'],
        raw: true
      })
    ]);

    // Map status group to object for easy access
    const statusCounts = statusGrouped.reduce((acc, current) => {
      acc[current.status] = parseInt(current.count) || 0;
      return acc;
    }, {});

    // Final attempt at overdue count: simple, direct and robust
    const overdueBorrowings = await Borrowing.count({
      where: {
        [Op.or]: [
          { status: 'overdue' },
          {
            status: { [Op.in]: ['borrowed', 'approved', 'returning'] },
            [Op.and]: [
              Sequelize.literal('`Borrowing`.`expectedReturnDate` < CURDATE()')
            ]
          }
        ]
      },
      include: isOfficer ? [{
        model: Item,
        as: 'item',
        required: true,
        include: [{
          model: Category,
          as: 'category',
          required: true,
          where: { managingDepartment: dept }
        }]
      }] : [],
      distinct: true
    });

    const formattedStatusStats = Object.keys(statusCounts).map(s => ({
      _id: s,
      count: statusCounts[s]
    }));

    // 4. Monthly Trends - Ensure all 12 months are returned
    let formattedTrends = [];
    try {
      const currentYear = new Date().getFullYear();
      const monthlyTrends = await Borrowing.findAll({
        attributes: [
          [Sequelize.literal('MONTH(createdAt)'), 'month_val'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'month_count']
        ],
        where: Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('createdAt')), currentYear),
        group: [Sequelize.literal('MONTH(createdAt)')],
        order: [[Sequelize.literal('MONTH(createdAt)'), 'ASC']],
        raw: true
      });

      // Create a map of existing data
      const trendMap = monthlyTrends.reduce((acc, t) => {
        acc[t.month_val] = parseInt(t.month_count) || 0;
        return acc;
      }, {});

      // Fill all 12 months
      for (let m = 1; m <= 12; m++) {
        formattedTrends.push({
          _id: { month: m },
          count: trendMap[m] || 0
        });
      }
    } catch (trendError) {
      console.error('Monthly trends error:', trendError);
      // Fallback to 12 empty months
      for (let m = 1; m <= 12; m++) {
        formattedTrends.push({ _id: { month: m }, count: 0 });
      }
    }

    res.json({
      totalBorrowings,
      pendingBorrowings: statusCounts.pending || 0,
      borrowedBorrowings: statusCounts.borrowed || 0,
      returnedBorrowings: statusCounts.returned || 0,
      overdueBorrowings: Math.max(Number(overdueBorrowings) || 0, statusCounts.overdue || 0),
      totalItems,
      totalUsers: req.user.role === 'admin' ? totalUsers : undefined,
      totalUnpaidPenalties: Number(totalUnpaidPenalties) || 0,
      statusStats: formattedStatusStats,
      monthlyTrends: formattedTrends
    });
  } catch (error) {
    console.error('Critical Dashboard Stats Fail:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current user borrowing history
// @route   GET /api/borrowings/user/history
// @access  Private
const getUserBorrowingHistory = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = { userId: req.user.id };

    if (search && !isNaN(search)) {
      whereClause.id = search;
    }

    const history = await Borrowing.findAll({
      where: whereClause,
      include: [
        { model: Item, as: 'item', attributes: ['name', 'image', 'description'] },
        { model: User, as: 'approverUser', attributes: ['fullName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(history);
  } catch (error) {
    console.error('Get borrowing history error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Cancel borrowing request
// @route   PUT /api/borrowings/:id/cancel
// @access  Private
const cancelBorrowing = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{ model: Item, as: 'item' }],
      transaction: t
    });

    if (!borrowing) {
      await t.rollback();
      return res.status(404).json({ message: 'Borrowing request not found' });
    }

    // Check if the user is the owner
    if (borrowing.userId !== req.user.id) {
      await t.rollback();
      return res.status(403).json({ message: 'You are not authorized to cancel this borrowing' });
    }

    // Check if status allows cancellation (pending or approved, but not yet borrowed/shipped)
    if (!['pending', 'approved'].includes(borrowing.status)) {
      await t.rollback();
      return res.status(400).json({ message: `Cannot cancel borrowing with status: ${borrowing.status}` });
    }

    const previousStatus = borrowing.status;

    // Update borrowing status
    await borrowing.update({
      status: 'cancelled',
      notes: `Cancelled by user at ${new Date().toISOString()}. ${borrowing.notes || ''}`
    }, { transaction: t });

    // Restore item stock (Return reserved quantity for pending/approved)
    await borrowing.item.update({
      availableQuantity: borrowing.item.availableQuantity + borrowing.quantity
    }, { transaction: t });

    // Notify Officers
    const officers = await User.findAll({ where: { role: 'officer' } });
    const notifications = officers.map(o => ({
      userId: o.id,
      title: 'Borrowing Cancelled',
      message: `${req.user.fullName} cancelled their ${previousStatus} request for ${borrowing.item.name}.`,
      type: 'borrow_cancelled',
      path: `/borrowings?search=${borrowing.id}`,
      relatedBorrowingId: borrowing.id
    }));
    await Notification.bulkCreate(notifications, { transaction: t });

    // Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Cancelled borrowing request for ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { previousStatus }
    }, { transaction: t });

    const createdNotifications = await Notification.findAll({
      where: { relatedBorrowingId: borrowing.id, type: 'borrow_cancelled' },
      transaction: t
    });

    await t.commit();

    // Broadcast to update lists
    emitToAll('borrowing:cancelled', { borrowingId: borrowing.id });

    // Notify officers via socket
    createdNotifications.forEach(notif => {
      emitToUser(notif.userId, 'notification', {
        _id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        path: notif.path,
        relatedBorrowingId: notif.relatedBorrowingId,
        createdAt: notif.createdAt
      });
    });

    res.json({ message: 'Borrowing request cancelled successfully', borrowing });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Cancel borrowing error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update penalty status (officer only)
// @route   PUT /api/borrowings/:id/penalty
// @access  Private (Officer/Admin)
const updatePenaltyStatus = async (req, res) => {
  try {
    const { penaltyStatus, penalty } = req.body;
    const borrowing = await Borrowing.findByPk(req.params.id);

    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing record not found' });
    }

    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const updateData = {};
    if (penaltyStatus !== undefined) updateData.penaltyStatus = penaltyStatus;
    if (penalty !== undefined) updateData.penalty = penalty;

    await borrowing.update(updateData);

    // If penalty is paid, check if user can be unblocked
    if (penaltyStatus === 'paid') {
      const otherOverdue = await Borrowing.count({
        where: {
          userId: borrowing.userId,
          status: { [Op.in]: ['borrowed', 'overdue'] },
          expectedReturnDate: { [Op.lt]: new Date() }
        }
      });

      const otherUnpaidPenalties = await Borrowing.count({
        where: {
          userId: borrowing.userId,
          penaltyStatus: 'unpaid',
          penalty: { [Op.gt]: 0 }
        }
      });

      if (otherOverdue === 0 && otherUnpaidPenalties === 0) {
        const user = await User.findByPk(borrowing.userId);
        if (user && user.isBlockedFromBorrowing) {
          await user.update({
            isBlockedFromBorrowing: false,
            blockReason: null
          });

          // Notify user about unblock
          const userNotif = await Notification.create({
            userId: user.id,
            title: '✅ Akun Diaktifkan Kembali',
            message: 'Denda telah dibayar dan tidak ada tunggakan barang. Anda dapat meminjam peralatan lagi.',
            type: 'return_approved',
            path: '/browse-items'
          });

          emitToUser(userNotif.userId, 'notification', {
            _id: userNotif.id,
            title: userNotif.title,
            message: userNotif.message,
            type: userNotif.type,
            path: userNotif.path,
            createdAt: userNotif.createdAt
          });
        }
      }
    } else if (penaltyStatus === 'unpaid' && (penalty !== undefined || borrowing.penalty > 0)) {
      // If set back to unpaid or adjusted, block again
      const user = await User.findByPk(borrowing.userId);
      if (user && !user.isBlockedFromBorrowing) {
        await user.update({
          isBlockedFromBorrowing: true,
          blockReason: 'You have unpaid equipment damage penalties.'
        });
      }
    }

    // Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Updated penalty status for borrowing ${borrowing.id}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { penaltyStatus, penalty }
    });

    res.json({ message: 'Penalty updated successfully', borrowing });
  } catch (error) {
    console.error('Update penalty error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createBorrowing,
  getBorrowings,
  getBorrowingById,
  approveBorrowing,
  rejectBorrowing,
  markAsBorrowed,
  requestReturn,
  approveReturn,
  getDashboardStats,
  getUserBorrowingHistory,
  cancelBorrowing,
  checkOverdueBorrowings,
  updatePenaltyStatus
};
