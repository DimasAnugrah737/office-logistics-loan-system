/**
 * Controller untuk mengelola proses peminjaman, persetujuan, dan pengembalian barang.
 */
const Borrowing = require('../models/Borrowing');
const Item = require('../models/Item');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const Category = require('../models/Category');
const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');
const { emitToUser, emitToAll } = require('../utils/socket');

// @desc    Create a new borrowing request
// @route   POST /api/borrowings
// @access  Private
const createBorrowing = async (req, res) => {
  // Use database transaction to ensure data integrity
  const t = await sequelize.transaction();
  try {
    const { itemId, quantity, borrowDate, expectedReturnDate, purpose } = req.body;

    // 0. Validation: Check if user is blocked (due to delays or penalties)
    if (req.user.isBlockedFromBorrowing) {
      await t.rollback();
      return res.status(403).json({
        message: `Borrowing suspended: ${req.user.blockReason || 'You have items that have not been returned.'}`,
        isBlocked: true
      });
    }

    // 0.1 Additional Validation: Check for unpaid damage penalties
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

    // 1. Validation: Check item stock availability
    const item = await Item.findByPk(itemId, {
      include: [{ model: Category, as: 'category' }],
      transaction: t
    });
    if (!item) {
      await t.rollback();
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if requested quantity is available
    if (!item.isAvailable || item.availableQuantity < quantity) {
      await t.rollback();
      return res.status(400).json({
        message: `Only ${item.availableQuantity} units available for borrowing`
      });
    }

    // 2. Create borrowing record with 'pending' status
    const borrowing = await Borrowing.create({
      userId: req.user.id,
      itemId,
      quantity,
      borrowDate: borrowDate || new Date(),
      expectedReturnDate,
      purpose,
      status: 'pending'
    }, { transaction: t });

    // 3. Reserve item stock (reduce available quantity to prevent over-borrowing)
    await item.update({
      availableQuantity: item.availableQuantity - quantity
    }, { transaction: t });

    // 4. Send notification to the Officer responsible for the related department
    const officers = await User.findAll({
      where: {
        role: 'officer',
        department: item.category?.managingDepartment || '' 
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

    // 5. Log borrowing activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Requested to borrow ${item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { quantity, expectedReturnDate }
    }, { transaction: t });

    // Get newly created notifications to send in real-time
    const createdNotifications = await Notification.findAll({
      where: { relatedBorrowingId: borrowing.id, type: 'borrow_request' },
      transaction: t
    });

    // Commit all changes to the database
    await t.commit();

    // Send Real-time event via Socket.io
    emitToAll('item:updated', item);
    emitToAll('borrowing:created', { borrowingId: borrowing.id });

    // Send direct notification to each officer via socket
    createdNotifications.forEach(notif => {
      emitToUser(notif.userId, 'notification', notif);
    });

    res.status(201).json(borrowing);
  } catch (error) {
    if (t) await t.rollback();
    console.error('Failed to create borrowing:', error.message);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

// @desc    Get all borrowing data (Admin/Officer gets all, User only their own)
// @route   GET /api/borrowings
// @access  Private
const getBorrowings = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, searchUser, searchItem, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = {};

    // If user is a regular user, only show their own borrowings
    if (req.user.role === 'user') {
      whereClause.userId = req.user.id;
    }

    if (status) {
      whereClause.status = status;
    }

    // Support searching by ID (for notification clicks)
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
      attributes: ['id', 'userId', 'itemId', 'quantity', 'borrowDate', 'expectedReturnDate', 'actualReturnDate', 'status', 'penalty', 'penaltyStatus', 'purpose', 'notes', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit) || 10,
      offset: parseInt(offset) || 0,
      distinct: true // Required for correct count calculation with includes
    });

    res.json({
      borrowings,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Failed to get borrowing data:', error.message);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

// @desc    Get borrowing data by ID
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
      return res.status(404).json({ message: 'Borrowing data not found' });
    }

    // Access control check
    if (req.user.role === 'user' && borrowing.userId !== req.user.id) {
      return res.status(403).json({ message: 'You do not have access rights' });
    }

    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      return res.status(403).json({ message: 'You do not have authority for this department' });
    }

    res.json(borrowing);
  } catch (error) {
    console.error('Failed to get borrowing data:', error.message);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

// @desc    Approve a borrowing request
// @route   PUT /api/borrowings/:id/approve
// @access  Private/Admin/Officer
const approveBorrowing = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { notes } = req.body;

    // 1. Role Validation: Only Officer or Admin can approve
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only officers or admins are allowed to approve borrowings' });
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

    // 2. Department Validation: Officers only manage items in their own department
    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      await t.rollback();
      return res.status(403).json({ message: `Access denied: You are only authorized to manage items in the ${req.user.department} department.` });
    }

    if (borrowing.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ message: `Cannot approve request with status: ${borrowing.status}` });
    }

    // 3. Update borrowing status to 'approved'
    await borrowing.update({
      status: 'approved',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      notes: notes || borrowing.notes
    }, { transaction: t });

    // 4. Send notification to the borrowing user
    const userNotif = await Notification.create({
      userId: borrowing.userId,
      title: 'Borrowing Approved',
      message: `Your request to borrow ${borrowing.item.name} has been approved.`,
      type: 'borrow_approved',
      path: `/my-borrowings?search=${borrowing.id}`,
      relatedBorrowingId: borrowing.id
    }, { transaction: t });

    // 5. Log approval activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Approved borrowing of ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { requesterId: borrowing.userId }
    }, { transaction: t });

    await t.commit();

    // Send real-time notification
    emitToUser(userNotif.userId, 'notification', userNotif);
    emitToAll('borrowing:approved', { borrowingId: borrowing.id });

    res.json({ message: 'Borrowing request approved', borrowing });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Failed to approve borrowing:', error.message);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

// @desc    Reject a borrowing request
// @route   PUT /api/borrowings/:id/reject
// @access  Private/Admin/Officer
const rejectBorrowing = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { reason, notes } = req.body; 

    // 1. Role Validation: Only Officer or Admin can reject
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only officers or admins are allowed to reject requests' });
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

    // 2. Department Validation: Officers only manage items in their department
    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      await t.rollback();
      return res.status(403).json({ message: `Access denied: You are only authorized to manage items in the ${req.user.department} department.` });
    }

    if (borrowing.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ message: 'Can only reject requests with pending status' });
    }

    const rejectionReason = reason || notes || 'Reason not specified';

    // 3. Update status to 'rejected'
    await borrowing.update({
      status: 'rejected',
      approvedBy: req.user.id,
      approvedAt: new Date(),
      notes: rejectionReason
    }, { transaction: t });

    // 4. Return Item Stock: Since rejected, the previously reserved stock is returned to 'available'
    await borrowing.item.update({
      availableQuantity: borrowing.item.availableQuantity + borrowing.quantity
    }, { transaction: t });

    // 5. Send Notification to User
    const userNotif = await Notification.create({
      userId: borrowing.userId,
      title: 'Borrowing Rejected',
      message: `Your request to borrow ${borrowing.item.name} has been rejected. Reason: ${rejectionReason}`,
      type: 'borrow_rejected',
      path: `/my-borrowings?search=${borrowing.id}`,
      relatedBorrowingId: borrowing.id
    }, { transaction: t });

    // 6. Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Rejected borrowing request: ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { reason: rejectionReason }
    }, { transaction: t });

    await t.commit();

    // Send real-time notification via Socket.io
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
    console.error('Failed to reject borrowing:', error.message);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};


// @desc    Mark item as physically borrowed/picked up
// @route   PUT /api/borrowings/:id/borrow
// @access  Private/Admin/Officer
const markAsBorrowed = async (req, res) => {
  try {
    const { conditionBefore, notes } = req.body;
    
    // Only Officer or Admin can hand over items
    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only officers or admins can hand over items' });
    }

    const borrowing = await Borrowing.findByPk(req.params.id, {
      include: [{
        model: Item,
        as: 'item',
        include: [{ model: Category, as: 'category' }]
      }]
    });

    if (!borrowing) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check department authority
    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      return res.status(403).json({ message: `Access denied: You are only authorized in the ${req.user.department} department.` });
    }

    if (borrowing.status !== 'approved') {
      return res.status(400).json({ message: 'Items can only be handed over if they have been approved' });
    }

    // Update status to 'borrowed' and record start condition
    await borrowing.update({
      status: 'borrowed',
      borrowDate: new Date(),
      conditionBefore: conditionBefore || 'good',
      notes: notes || borrowing.notes
    });

    // Record in Activity Log
    await ActivityLog.create({
      userId: req.user.id,
      action: `Item has been handed over to borrower: ${borrowing.id}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { conditionBefore }
    });

    // Broadcast update
    emitToAll('borrowing:borrowed', { borrowingId: borrowing.id });

    res.json({ message: 'Item successfully marked as borrowed', borrowing });
  } catch (error) {
    console.error('Failed to mark item as borrowed:', error.message);
    res.status(500).json({ message: 'System error occurred' });
  }
};

// @desc    Submit return request by borrower
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

    // Ensure only the borrower can submit the request
    if (borrowing.userId !== req.user.id) {
      return res.status(403).json({ message: 'Not the owner of this borrowing' });
    }

    if (borrowing.status !== 'borrowed' && borrowing.status !== 'overdue') {
      return res.status(400).json({ message: 'Can only return items that are currently borrowed' });
    }

    // Update status to 'returning'
    await borrowing.update({
      status: 'returning',
      conditionAfter: conditionAfter || 'good',
      notes: notes || borrowing.notes
    });

    // Notify admins and responsible officers
    const officials = await User.findAll({
      where: {
        [Op.or]: [
          { role: 'admin' },
          { role: 'officer', department: borrowing.item?.category?.managingDepartment || '' }
        ]
      }
    });

    const notifications = officials.map(o => ({
      userId: o.id,
      title: 'Return Request',
      message: `${req.user.fullName} is returning ${borrowing.quantity}x ${borrowing.item.name}.`,
      type: 'return_request',
      path: `/borrowings?search=${borrowing.id}`,
      relatedBorrowingId: borrowing.id
    }));

    await Notification.bulkCreate(notifications);

    // Record in Log
    await ActivityLog.create({
      userId: req.user.id,
      action: `Submitted return request for: ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { conditionAfter }
    });

    // Broadcast to update the list
    emitToAll('borrowing:returned', { borrowingId: borrowing.id });

    // Get newly created notifications for socket delivery
    const createdNotifications = await Notification.findAll({
      where: { relatedBorrowingId: borrowing.id, type: 'return_request' }
    });

    // Send real-time notifications to related officials
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

    res.json({ message: 'Return request has been submitted', borrowing });
  } catch (error) {
    console.error('Failed to submit return request:', error.message);
    res.status(500).json({ message: 'System error occurred' });
  }
};

// @desc    Approve item return and update stock
// @route   PUT /api/borrowings/:id/approve-return
// @access  Private/Admin/Officer
const approveReturn = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 1. Role Validation: Only Officer or Admin can approve return
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

    // 2. Department Validation: Officers only manage items in their department
    if (req.user.role === 'officer' && borrowing.item?.category?.managingDepartment !== req.user.department) {
      await t.rollback();
      return res.status(403).json({ message: `Access denied: You are only authorized to manage items in the ${req.user.department} department.` });
    }

    // Avoid double approval
    if (borrowing.returnApprovedAt) {
      await t.rollback();
      return res.status(400).json({ message: 'Return already approved' });
    }

    // 3. Prepare return update data
    const updateData = {
      status: 'returned',
      actualReturnDate: new Date(),
      returnApprovedBy: req.user.id,
      returnApprovedAt: new Date(),
      conditionAfter: conditionAfter || 'good',
      notes: notes || borrowing.notes
    };

    // Apply penalty if item is broken
    if (conditionAfter === 'broken' && penalty !== undefined) {
      updateData.penalty = penalty;
      updateData.penaltyStatus = penaltyStatus || 'unpaid';
    }

    // Update borrowing data
    await borrowing.update(updateData, { transaction: t });

    // 4. User Blocking Management (if overdue or penalty)
    const borrowingUser = await User.findByPk(borrowing.userId, { transaction: t });

    if (updateData.penalty > 0 && updateData.penaltyStatus === 'unpaid') {
      // Block if there are unpaid penalties
      if (borrowingUser) {
        await borrowingUser.update({
          isBlockedFromBorrowing: true,
          blockReason: `Unpaid damage penalty for item: ${borrowing.item.name}.`
        }, { transaction: t });
      }
    } else {
      // Check if user still has other overdue items or penalties before unblocking
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
          await borrowingUser.update({ isBlockedFromBorrowing: false, blockReason: null }, { transaction: t });
        }
      }
    }

    // 5. STOCK RETURN & SPLITTING LOGIC (If condition changed)
    const originalItem = borrowing.item;
    const returnedQty = borrowing.quantity;
    const newCondition = conditionAfter || originalItem.condition;

    // If condition changes (e.g. borrowed 'good' returned 'broken') and item is part of a larger stock
    if (newCondition !== originalItem.condition && originalItem.quantity > returnedQty) {
      // Reduce the count from the old condition stock
      await originalItem.update({
        quantity: originalItem.quantity - returnedQty
      }, { transaction: t });

      // Find or create a new item entry for the new condition
      let splitItem = await Item.findOne({
        where: {
          name: originalItem.name,
          categoryId: originalItem.categoryId,
          condition: newCondition
        },
        transaction: t
      });

      if (splitItem) {
        const splitItemUpdateData = {
          quantity: splitItem.quantity + returnedQty
        };
        
        if (newCondition === 'broken') {
          splitItemUpdateData.brokenQuantity = splitItem.brokenQuantity + returnedQty;
        } else {
          splitItemUpdateData.availableQuantity = splitItem.availableQuantity + returnedQty;
        }
        
        await splitItem.update(splitItemUpdateData, { transaction: t });
      } else {
        await Item.create({
          name: originalItem.name,
          description: originalItem.description,
          categoryId: originalItem.categoryId,
          quantity: returnedQty,
          availableQuantity: newCondition === 'broken' ? 0 : returnedQty,
          brokenQuantity: newCondition === 'broken' ? returnedQty : 0,
          condition: newCondition,
          location: originalItem.location,
          image: originalItem.image,
          specifications: originalItem.specifications,
          createdBy: req.user.id,
          isAvailable: newCondition !== 'broken',
          managedBy: originalItem.managedBy
        }, { transaction: t });
      }
    } else {
      // Standard return: Update the original item stock correctly
      const itemUpdateDataRecord = {
        condition: originalItem.condition 
      };

      if (newCondition === 'broken') {
        itemUpdateDataRecord.brokenQuantity = originalItem.brokenQuantity + returnedQty;
      } else {
        itemUpdateDataRecord.availableQuantity = originalItem.availableQuantity + returnedQty;
      }

      await originalItem.update(itemUpdateDataRecord, { transaction: t });
    }

    // 6. Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Approved return of ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { conditionAfter: conditionAfter || 'good', penalty: updateData.penalty }
    }, { transaction: t });

    // 7. Send Notification to User
    let userNotif;
    if (updateData.penalty > 0 && updateData.penaltyStatus === 'unpaid') {
      userNotif = await Notification.create({
        userId: borrowing.userId,
        title: '⚠️ Damage Penalty',
        message: `Return of ${borrowing.item.name} completed with a penalty. Account suspended until paid.`,
        type: 'overdue_warning',
        path: `/my-borrowings?search=${borrowing.id}`,
        relatedBorrowingId: borrowing.id
      }, { transaction: t });
    } else {
      userNotif = await Notification.create({
        userId: borrowing.userId,
        title: 'Return Approved',
        message: `Your return of item ${borrowing.item.name} has been approved.`,
        type: 'return_approved',
        path: `/my-borrowings?search=${borrowing.id}`,
        relatedBorrowingId: borrowing.id
      }, { transaction: t });
    }

    // Complete transaction
    await t.commit();

    // Send real-time notification via Socket.io
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
    console.error('Failed to approve return:', error.message);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

// @desc    Automatic Check & Alert: Detect tiered borrowing delays
//          Run periodically by the server every hour.
const checkOverdueBorrowings = async () => {
  try {
    // Search for potentially overdue borrowings
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

      // Calculate day difference (rounded up)
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let level = 0;
      let title = '';
      let message = '';
      let shouldBlock = false;
      let shouldMarkOverdue = false;

      // --- TIERED ALARM LOGIC ---

      // Level 1: Reminder H-1 (One day before due date)
      if (diffDays === -1) {
        level = 1;
        title = '⏳ Reminder: Tomorrow is Due Date';
        message = `${borrowing.item?.name} is scheduled to be returned tomorrow. Please prepare the item.`;
      }
      // Level 2: Due Date (Deadline today)
      else if (diffDays === 0) {
        level = 2;
        title = '📅 Deadline Today';
        message = `The deadline to return ${borrowing.item?.name} is today. Please return it to the officer immediately.`;
      }
      // Level 3: Overdue H+1
      else if (diffDays >= 1) {
        level = 3;
        title = '⚠️ Overdue Warning';
        message = `The return of ${borrowing.item?.name} is ${diffDays} day(s) late. Please return it immediately!`;
        shouldMarkOverdue = true;
      }
      // Level 4: Account Suspension H+2
      if (diffDays >= 2) {
        level = 4;
        title = '🚫 Account Suspended';
        message = `Borrowing ${borrowing.item?.name} is ${diffDays} day(s) late. New borrowing rights are temporarily disabled.`;
        shouldBlock = true;
      }
      // Level 5: Critical Escalation > H+4
      if (diffDays > 4) {
        level = 5;
        title = '🛑 Critical Warning';
        message = `Borrowing ${borrowing.item?.name} is more than 4 days late. This report has been forwarded to the relevant Department.`;
      }

      const currentTime = new Date();

      // Decide whether to send notification: only if alarm level increases, OR status just changed to overdue
      const shouldNotify = (level > borrowing.lastEscalation) || 
                          (shouldMarkOverdue && borrowing.status !== 'overdue');

      if (level > 0 && shouldNotify) {
        try {
          // Double-check: don't create more than one in-app notification within a 3-hour window
          const recentNotif = await Notification.findOne({
            where: {
              userId: borrowing.userId,
              relatedBorrowingId: borrowing.id,
              type: 'overdue_warning',
              createdAt: { [Op.gt]: new Date(currentTime.getTime() - 2.8 * 60 * 60 * 1000) }
            }
          });
          
          if (recentNotif) continue;

          // 1. Create Notification for Borrower
          const userNotif = await Notification.create({
            userId: borrowing.userId,
            title,
            message,
            type: 'overdue_warning',
            path: `/my-borrowings?search=${borrowing.id}`,
            relatedBorrowingId: borrowing.id
          });

          // 2. Update escalation state in database
          await Borrowing.update({ 
            lastEscalation: level,
            lastNotificationAt: currentTime,
            status: (shouldMarkOverdue && borrowing.status !== 'overdue') ? 'overdue' : borrowing.status
          }, { 
            where: { id: borrowing.id } 
          });

          // 3. Block User if critical deadline passed
          if (shouldBlock && !borrowing.user?.isBlockedFromBorrowing) {
            await User.update({
              isBlockedFromBorrowing: true,
              blockReason: `Overdue returning ${borrowing.item?.name} for ${diffDays} day(s).`
            }, { 
              where: { id: borrowing.userId } 
            });
          }

          // Emit to Borrower
          emitToUser(userNotif.userId, 'notification', {
            _id: userNotif.id,
            title: userNotif.title,
            message: userNotif.message,
            type: userNotif.type,
            path: userNotif.path,
            relatedBorrowingId: userNotif.relatedBorrowingId,
            createdAt: userNotif.createdAt
          });

          // 4. Report to Relevant Officer if Overdue (Lvl >= 3)
          if (level >= 3) {
            const officers = await User.findAll({
              where: {
                role: 'officer',
                department: borrowing.item?.category?.managingDepartment || '',
                id: { [Op.ne]: borrowing.userId }
              }
            });
            for (const officer of officers) {
              const recentOfficerNotif = await Notification.findOne({
                where: {
                  userId: officer.id,
                  relatedBorrowingId: borrowing.id,
                  createdAt: { [Op.gt]: new Date(currentTime.getTime() - 2.8 * 60 * 60 * 1000) }
                }
              });

              if (!recentOfficerNotif) {
                const officerNotif = await Notification.create({
                  userId: officer.id,
                  title: `Overdue Report: ${borrowing.user?.fullName}`,
                  message: `${borrowing.user?.fullName} has not returned ${borrowing.item?.name} (${diffDays} day(s) late).`,
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
          }
        } catch (err) {
          console.error(`Failed to send overdue notification for borrowing ${borrowing.id}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error('Failed to run automatic overdue check:', error.message);
  }
};

// @desc    Get statistical summary for Dashboard
// @route   GET /api/borrowings/stats/dashboard
// @access  Private/Admin/Officer
const getDashboardStats = async (req, res) => {
  try {
    const isOfficer = req.user.role === 'officer';
    const dept = req.user.department;

    // Run multiple counts in parallel for performance
    const [
      totalItems,
      totalUsers,
      totalBorrowings,
      totalUnpaidPenalties,
      statusGrouped
    ] = await Promise.all([
      // Total items managed (filtered by department if officer)
      Item.count({
        include: isOfficer ? [{
          model: Category,
          as: 'category',
          attributes: [],
          required: true,
          where: { managingDepartment: dept }
        }] : [],
        distinct: true,
        col: 'id'
      }),
      // Total active users
      User.count({ where: { role: { [Op.in]: ['officer', 'user'] } } }),
      // Total borrowing transactions
      Borrowing.count({
        include: isOfficer ? [{
          model: Item,
          as: 'item',
          attributes: [],
          required: true,
          include: [{
            model: Category,
            as: 'category',
            attributes: [],
            required: true,
            where: { managingDepartment: dept }
          }]
        }] : [],
        distinct: true,
        col: 'id'
      }),
      // Accumulated unpaid penalties
      Borrowing.sum('penalty', {
        where: { penaltyStatus: 'unpaid' },
        include: isOfficer ? [{
          model: Item,
          as: 'item',
          attributes: [],
          required: true,
          include: [{
            model: Category,
            as: 'category',
            attributes: [],
            required: true,
            where: { managingDepartment: dept }
          }]
        }] : []
      }),
      // Borrowing stats grouped by status (Pending, Borrowed, etc.)
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

    // Map group by status results into an object for easy access
    const statusCounts = statusGrouped.reduce((acc, current) => {
      acc[current.status] = parseInt(current.count) || 0;
      return acc;
    }, {});

    // Count borrowings that are actually late based on date (outside 'overdue' status label)
    const overdueBorrowingsCount = await Borrowing.count({
      where: {
        [Op.or]: [
          { status: 'overdue' },
          {
            status: { [Op.in]: ['borrowed', 'approved', 'returning'] },
            expectedReturnDate: { [Op.lt]: new Date() }
          }
        ]
      },
      include: isOfficer ? [{
        model: Item,
        as: 'item',
        attributes: [],
        required: true,
        include: [{
          model: Category,
          as: 'category',
          attributes: [],
          required: true,
          where: { managingDepartment: dept }
        }]
      }] : [],
      distinct: true,
      col: 'id'
    });

    const formattedStatusStats = Object.keys(statusCounts).map(s => ({
      _id: s,
      count: statusCounts[s]
    }));

    // --- Monthly Trend Stats (Chart) ---
    let formattedTrends = [];
    try {
      const currentYear = new Date().getFullYear();
      const monthlyTrends = await Borrowing.findAll({
        attributes: [
          [Sequelize.literal('MONTH(Borrowing.createdAt)'), 'month_val'],
          [Sequelize.fn('COUNT', Sequelize.col('Borrowing.id')), 'month_count']
        ],
        where: Sequelize.where(Sequelize.fn('YEAR', Sequelize.col('Borrowing.createdAt')), currentYear),
        include: isOfficer ? [{
          model: Item,
          as: 'item',
          attributes: [],
          required: true,
          include: [{
            model: Category,
            as: 'category',
            attributes: [],
            required: true,
            where: { managingDepartment: dept }
          }]
        }] : [],
        group: [Sequelize.literal('MONTH(Borrowing.createdAt)')],
        order: [[Sequelize.literal('MONTH(Borrowing.createdAt)'), 'ASC']],
        raw: true
      });

      const trendMap = monthlyTrends.reduce((acc, t) => {
        acc[t.month_val] = parseInt(t.month_count) || 0;
        return acc;
      }, {});

      // Ensure 12 months are always filled, even if data is zero
      for (let m = 1; m <= 12; m++) {
        formattedTrends.push({
          _id: { month: m },
          count: trendMap[m] || 0
        });
      }
    } catch (trendError) {
      console.error('Failed to get monthly trends:', trendError);
      for (let m = 1; m <= 12; m++) formattedTrends.push({ _id: { month: m }, count: 0 });
    }

    res.json({
      totalBorrowings,
      pendingBorrowings: statusCounts.pending || 0,
      borrowedBorrowings: statusCounts.borrowed || 0,
      returnedBorrowings: statusCounts.returned || 0,
      overdueBorrowings: Math.max(Number(overdueBorrowingsCount) || 0, statusCounts.overdue || 0),
      totalItems,
      totalUsers,
      totalUnpaidPenalties: Number(totalUnpaidPenalties) || 0,
      statusStats: formattedStatusStats,
      monthlyTrends: formattedTrends
    });
  } catch (error) {
    console.error('Failed to load dashboard statistics:', error);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

// @desc    Get current user's borrowing history
// @route   GET /api/borrowings/user/history
// @access  Private
const getUserBorrowingHistory = async (req, res) => {
  try {
    const { search } = req.query;
    const whereClause = { userId: req.user.id };

    // Search by specific ID if numeric input exists
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
    console.error('Failed to retrieve borrowing history:', error.message);
    res.status(500).json({ message: 'System error occurred' });
  }
};

// @desc    Cancel a borrowing request (by user)
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

    // Ensure cancellation is done by the original owner
    if (borrowing.userId !== req.user.id) {
      await t.rollback();
      return res.status(403).json({ message: 'Unauthorized to cancel this borrowing' });
    }

    // Check if status allows cancellation (Only possible if 'pending' or 'approved' but not yet picked up)
    if (!['pending', 'approved'].includes(borrowing.status)) {
      await t.rollback();
      return res.status(400).json({ message: `Cannot cancel borrowing with status: ${borrowing.status}` });
    }

    const previousStatus = borrowing.status;

    // Update status to 'cancelled'
    await borrowing.update({
      status: 'cancelled',
      notes: `Cancelled by user on ${new Date().toLocaleString()}. ${borrowing.notes || ''}`
    }, { transaction: t });

    // Return previously reserved item stock
    await borrowing.item.update({
      availableQuantity: borrowing.item.availableQuantity + borrowing.quantity
    }, { transaction: t });

    // Notify officers about the cancellation
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

    // Record Activity Log
    await ActivityLog.create({
      userId: req.user.id,
      action: `Cancelled borrowing request for: ${borrowing.item.name}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { previousStatus }
    }, { transaction: t });

    await t.commit();

    // Broadcast update to all clients for list refresh
    emitToAll('borrowing:cancelled', { borrowingId: borrowing.id });

    // Notify admins and officers real-time
    const adminsAndOfficers = await User.findAll({ 
      where: { 
        role: { [Op.in]: ['admin', 'officer'] } 
      } 
    });

    adminsAndOfficers.forEach(person => {
      emitToUser(person.id, 'notification', {
        title: 'Borrowing Cancelled',
        message: `${req.user.fullName} cancelled their ${previousStatus} request for ${borrowing.item.name}.`,
        type: 'borrow_cancelled',
        path: `/borrowings?search=${borrowing.id}`,
        relatedBorrowingId: borrowing.id,
        createdAt: new Date()
      });
    });

    res.json({ message: 'Borrowing request successfully cancelled', borrowing });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Failed to cancel borrowing:', error.message);
    res.status(500).json({ message: 'System error occurred' });
  }
};

/**
 * @desc    Update penalty status (officer/admin only)
 * @route   PUT /api/borrowings/:id/penalty
 * @access  Private (Officer/Admin)
 */
const updatePenaltyStatus = async (req, res) => {
  try {
    const { penaltyStatus, penalty } = req.body;
    const borrowing = await Borrowing.findByPk(req.params.id);

    if (!borrowing) {
      return res.status(404).json({ message: 'Borrowing record not found' });
    }

    if (req.user.role !== 'officer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updateData = {};
    if (penaltyStatus !== undefined) updateData.penaltyStatus = penaltyStatus;
    if (penalty !== undefined) updateData.penalty = penalty;

    await borrowing.update(updateData);
    
    // Ensure memory data is synced with latest database
    await borrowing.reload();

    // If penalty is paid, check if user blocking can be lifted
    if (penaltyStatus === 'paid') {
      // Check if user still has overdue items
      const otherOverdue = await Borrowing.count({
        where: {
          userId: borrowing.userId,
          status: { [Op.in]: ['borrowed', 'overdue'] },
          expectedReturnDate: { [Op.lt]: new Date() }
        }
      });

      // Check other unique unpaid penalties
      const otherUnpaidPenalties = await Borrowing.count({
        where: {
          userId: borrowing.userId,
          penaltyStatus: 'unpaid',
          penalty: { [Op.gt]: 0 },
          id: { [Op.ne]: borrowing.id }
        }
      });

      // If clear from issues, lift account suspension
      if (otherOverdue === 0 && otherUnpaidPenalties === 0) {
        const user = await User.findByPk(borrowing.userId);
        if (user && user.isBlockedFromBorrowing) {
          await user.update({ isBlockedFromBorrowing: false, blockReason: null });

          // Notify user that borrowing rights are active again
          const userNotif = await Notification.create({
            userId: user.id,
            title: '✅ Account Re-activated',
            message: 'Penalty has been paid and there are no overdue items. You can borrow equipment again.',
            type: 'return_approved',
            path: '/browse-items'
          });

          emitToUser(user.id, 'user:updated', user.toJSON());
          
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
    } else if (penaltyStatus === 'unpaid' && (penalty > 0 || borrowing.penalty > 0)) {
      // If set back to unpaid, relock the account
      const user = await User.findByPk(borrowing.userId);
      if (user && !user.isBlockedFromBorrowing) {
        await user.update({
          isBlockedFromBorrowing: true,
          blockReason: 'There is an outstanding unpaid damage penalty.'
        });
      }
    }

    // Record Activity Log
    await ActivityLog.create({
      userId: req.user.id,
      action: `Updated penalty status for borrowing #${borrowing.id}`,
      entityType: 'borrowing',
      entityId: borrowing.id,
      details: { penaltyStatus, penalty }
    });

    res.json({ message: 'Penalty status successfully updated', borrowing });
    
    // Broadcast latest penalty status
    emitToAll('borrowing:updated', { 
      borrowingId: borrowing.id, 
      penaltyStatus: borrowing.penaltyStatus,
      penalty: borrowing.penalty 
    });
  } catch (error) {
    console.error('Failed to update penalty:', error.message);
    res.status(500).json({ message: 'System error occurred' });
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
  updatePenaltyStatus,
  /**
   * @desc    Delete borrowing record including notifications & logs (Admin Only)
   * @route   DELETE /api/borrowings/:id
   * @access  Private/Admin
   */
  deleteBorrowing: async (req, res) => {
    const t = await sequelize.transaction();
    try {
      if (req.user.role !== 'admin') {
        await t.rollback();
        return res.status(403).json({ message: 'Only Admin is authorized to permanently delete data' });
      }

      const borrowing = await Borrowing.findByPk(req.params.id);
      if (!borrowing) {
        await t.rollback();
        return res.status(404).json({ message: 'Record not found' });
      }

      // Clean up related data to avoid foreign key errors
      await Notification.destroy({ where: { relatedBorrowingId: borrowing.id }, transaction: t });
      await ActivityLog.destroy({ where: { entityType: 'borrowing', entityId: borrowing.id }, transaction: t });
      
      // Delete main record
      await borrowing.destroy({ transaction: t });

      await t.commit();
      
      // Sync other units via socket
      emitToAll('borrowing:deleted', { borrowingId: req.params.id });

      res.json({ message: 'Borrowing record permanently deleted' });
    } catch (error) {
      if (t) await t.rollback();
      console.error('Failed to delete borrowing:', error);
      res.status(500).json({ message: 'System error occurred' });
    }
  }
};
