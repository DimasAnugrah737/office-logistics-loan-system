const Item = require('../models/Item');
const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');
const Borrowing = require('../models/Borrowing');
const Notification = require('../models/Notification');
const { Op } = require('sequelize');
const fs = require('fs');
const { emitToAll } = require('../utils/socket');

// @desc    Create a new item
// @route   POST /api/items
// @access  Private/Admin,Officer
const createItem = async (req, res) => {
  try {
    const {
      name,
      description,
      categoryId,
      serialNumber,
      quantity,
      condition,
      location,
      image
    } = req.body;

    const quantityInt = parseInt(quantity);
    const categoryIdInt = parseInt(categoryId);

    if (isNaN(quantityInt) || quantityInt < 0) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    if (isNaN(categoryIdInt)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const category = await Category.findByPk(categoryIdInt);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    const item = await Item.create({
      name,
      description,
      categoryId: categoryIdInt,
      serialNumber: serialNumber || null,
      quantity: quantityInt,
      availableQuantity: quantityInt,
      condition,
      location,
      image: req.file ? `/uploads/items/${req.file.filename}` : image,
      createdBy: req.user.id
    });

    // Broadcast to all users
    emitToAll('item:created', item);

    // Log Activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Create item: ${name}`,
      entityType: 'item',
      entityId: item.id,
      details: { quantity: quantityInt, categoryId: categoryIdInt }
    });

    res.status(201).json(item);

  } catch (error) {
    console.error('Create item error:', error);
    try {
      fs.writeFileSync('backend_error.log', `Create Item Error: ${error.message}\n${error.stack}\n`);
    } catch (logError) {
      console.error('Failed to write to log file:', logError);
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// @desc    Get all items
// @route   GET /api/items
// @access  Private
const getItems = async (req, res) => {
  try {
    const { page = 1, limit = 10, categoryId, search, available } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (categoryId) whereClause.categoryId = categoryId;
    if (available === 'true') {
      whereClause.isAvailable = true;
      whereClause.availableQuantity = { [Op.gt]: 0 };
    }
    if (search) {
      whereClause.name = { [Op.like]: `%${search}%` };
    }

    const { count, rows: items } = await Item.findAndCountAll({
      where: whereClause,
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'managingDepartment'],
        where: req.user.role === 'officer' ? { managingDepartment: req.user.department } : undefined,
        required: req.user.role === 'officer'
      }],
      attributes: ['id', 'name', 'description', 'categoryId', 'serialNumber', 'quantity', 'availableQuantity', 'condition', 'location', 'image', 'isAvailable'],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit) > 0 ? parseInt(limit) : 10,
      offset: parseInt(offset) >= 0 ? parseInt(offset) : 0,
      distinct: true
    });

    res.json({
      items,
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page)
    });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get item by ID
// @route   GET /api/items/:id
// @access  Private/Admin,Officer
const getItemById = async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'description']
      }]
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Get item error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update item
// @route   PUT /api/items/:id
// @access  Private/Admin,Officer
const updateItem = async (req, res) => {
  try {
    const {
      name,
      description,
      categoryId,
      serialNumber,
      quantity,
      condition,
      location,
      specifications,
      isAvailable,
      image
    } = req.body;

    const quantityInt = quantity ? parseInt(quantity) : undefined;
    const categoryIdInt = categoryId ? parseInt(categoryId) : undefined;

    // Parse specifications if string (from FormData)
    let parsedSpecs = specifications;
    if (typeof specifications === 'string') {
      try {
        parsedSpecs = JSON.parse(specifications);
      } catch (e) {
        // Keep as string or ignore
      }
    }

    // Parse isAvailable string "true"/"false"
    let isAvailableBool = isAvailable;
    if (isAvailable === 'true') isAvailableBool = true;
    if (isAvailable === 'false') isAvailableBool = false;

    const imagePath = req.file ? `/uploads/items/${req.file.filename}` : (typeof image === 'string' ? image : undefined);

    let item = await Item.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if serial number already exists
    if (serialNumber && serialNumber !== item.serialNumber) {
      const serialExists = await Item.findOne({
        where: {
          serialNumber,
          id: { [Op.ne]: item.id }
        }
      });
      if (serialExists) {
        return res.status(400).json({ message: 'Serial number already exists' });
      }
    }

    // Check if category exists
    if (categoryIdInt) {
      const categoryExists = await Category.findByPk(categoryIdInt);
      if (!categoryExists) {
        return res.status(404).json({ message: 'Category not found' });
      }
    }

    // Update available quantity if total quantity changes
    let availableQuantity = item.availableQuantity;
    if (quantityInt !== undefined && quantityInt !== item.quantity) {
      const difference = quantityInt - item.quantity;
      availableQuantity = item.availableQuantity + difference;
      if (availableQuantity < 0) availableQuantity = 0;
    }

    await item.update({
      name: name || item.name,
      description: description || item.description,
      categoryId: categoryIdInt || item.categoryId,
      serialNumber: serialNumber === '' ? null : (serialNumber || item.serialNumber),
      quantity: quantityInt !== undefined ? quantityInt : item.quantity,
      availableQuantity,
      condition: condition || item.condition,
      location: location || item.location,
      image: imagePath !== undefined ? imagePath : item.image,
      specifications: parsedSpecs || item.specifications,
      isAvailable: isAvailableBool !== undefined ? isAvailableBool : item.isAvailable
    });

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Update item: ${name || item.name}`,
      entityType: 'item',
      entityId: item.id,
      details: { quantity: item.quantity, availableQuantity: item.availableQuantity }
    });

    const updatedItem = await Item.findByPk(item.id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name']
      }]
    });

    // Broadcast to all users
    emitToAll('item:updated', updatedItem);

    res.json(updatedItem);
  } catch (error) {
    console.error('Update item error:', error);
    try {
      fs.writeFileSync('backend_error.log', `Update Item Error: ${error.message}\n${error.stack}\n`);
    } catch (logError) {
      console.error('Failed to write to log file:', logError);
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete item
// @route   DELETE /api/items/:id
// @access  Private/Admin
const deleteItem = async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Get all borrowing IDs for this item
    const borrowings = await Borrowing.findAll({
      where: { itemId: req.params.id },
      attributes: ['id']
    });
    const borrowingIds = borrowings.map(b => b.id);

    // Delete notifications related to these borrowings first
    if (borrowingIds.length > 0) {
      await Notification.destroy({
        where: { relatedBorrowingId: borrowingIds }
      });
    }

    // Delete all related borrowing records (cascade delete)
    await Borrowing.destroy({
      where: { itemId: req.params.id }
    });

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Delete item: ${item.name}`,
      entityType: 'item',
      entityId: item.id
    });

    await item.destroy();

    // Broadcast to all users
    emitToAll('item:deleted', { id: req.params.id });

    res.json({ message: 'Item removed' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem
};