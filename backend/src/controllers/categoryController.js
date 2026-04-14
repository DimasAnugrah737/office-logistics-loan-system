const Category = require('../models/Category');
const Item = require('../models/Item');
const ActivityLog = require('../models/ActivityLog');
const { Op } = require('sequelize');
const { emitToAll } = require('../utils/socket');

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private/Admin
const createCategory = async (req, res) => {
  try {
    const { name, code, description, managingDepartment } = req.body;

    // Check if category name or code already exists
    const categoryExists = await Category.findOne({ 
      where: { 
        [Op.or]: [
          { name },
          { code }
        ]
      } 
    });
    
    if (categoryExists) {
      return res.status(400).json({ 
        message: categoryExists.name === name ? 'Category name already exists' : 'Category code already exists' 
      });
    }

    const category = await Category.create({
      name,
      code,
      description,
      managingDepartment: managingDepartment || null,
      createdBy: req.user.id
    });

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Create category: ${name}`,
      entityType: 'category',
      entityId: category.id
    });

    // Broadcast to all users
    emitToAll('category:created', category);

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Private
const getCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      include: [{
        model: require('../models/User'),
        as: 'creator',
        attributes: ['fullName']
      }],
      order: [['name', 'ASC']]
    });

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
const updateCategory = async (req, res) => {
  try {
    const { name, code, description, managingDepartment } = req.body;

    let category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check duplicate name or code
    if ((name && name !== category.name) || (code && code !== category.code)) {
      const duplicate = await Category.findOne({
        where: {
          [Op.or]: [
            ...(name ? [{ name }] : []),
            ...(code ? [{ code }] : [])
          ],
          id: { [Op.ne]: category.id }
        }
      });
      
      if (duplicate) {
        return res.status(400).json({ 
          message: duplicate.name === name ? 'Category name already exists' : 'Category code already exists' 
        });
      }
    }

    category.name = name || category.name;
    category.code = code || category.code;
    category.description = description || category.description;
    category.managingDepartment = managingDepartment !== undefined ? managingDepartment : category.managingDepartment;

    const updatedCategory = await category.save();

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Update category: ${name}`,
      entityType: 'category',
      entityId: updatedCategory.id
    });

    // Broadcast to all users
    emitToAll('category:updated', updatedCategory);

    res.json(updatedCategory);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has items
    const itemExists = await Item.findOne({ where: { categoryId: req.params.id } });
    if (itemExists) {
      return res.status(400).json({ message: 'Cannot delete category that contains items. Please move or delete the items first.' });
    }

    // Log activity
    await ActivityLog.create({
      userId: req.user.id,
      action: `Delete category: ${category.name}`,
      entityType: 'category',
      entityId: category.id
    });

    await category.destroy({ force: true });

    // Broadcast to all users
    emitToAll('category:deleted', { id: req.params.id });

    res.json({ message: 'Category removed' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory
};