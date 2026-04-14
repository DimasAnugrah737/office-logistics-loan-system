/**
 * Controller untuk mengelola item inventaris (alat kantor).
 */
const Item = require('../models/Item');
const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const Borrowing = require('../models/Borrowing');
const Notification = require('../models/Notification');
const { Op } = require('sequelize');
const fs = require('fs');
const { emitToAll } = require('../utils/socket');

/**
 * @desc    Menambah barang baru ke inventaris
 * @route   POST /api/items
 * @access  Private/Admin,Officer
 */
const createItem = async (req, res) => {
  try {
    const {
      name,
      description,
      categoryId,
      serialNumber,
      quantity,
      brokenQuantity,
      condition,
      location,
      managedBy,
      image
    } = req.body;

    const quantityInt = parseInt(quantity);
    const brokenQuantityInt = (brokenQuantity !== undefined && brokenQuantity !== '') ? parseInt(brokenQuantity) : 0;
    const categoryIdInt = parseInt(categoryId);

    // Validasi input angka
    if (isNaN(quantityInt) || quantityInt < 0) {
      return res.status(400).json({ message: "Invalid item quantity" });
    }

    if (isNaN(categoryIdInt)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Periksa apakah kategori ada
    const category = await Category.findByPk(categoryIdInt);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Jika Petugas, pastikan mereka hanya bisa menambah barang di kategori departemen mereka
    if (req.user.role === 'officer') {
      if (category.managingDepartment !== req.user.department) {
        return res.status(403).json({ message: "You are only allowed to add items to categories in your own department" });
      }
    }

    // Hitung stok awal yang tersedia
    const initialAvailable = Math.max(0, quantityInt - brokenQuantityInt);

    // Buat entri barang baru
    const item = await Item.create({
      name,
      description,
      categoryId: categoryIdInt,
      serialNumber: serialNumber || null,
      quantity: quantityInt,
      brokenQuantity: brokenQuantityInt,
      availableQuantity: initialAvailable,
      condition,
      location,
      // If file is uploaded, use path, otherwise use image string (URL)
      image: req.file ? `/uploads/items/${req.file.filename}` : image,
      createdBy: req.user.id,
      managedBy: req.user.role === 'officer' ? req.user.id : (managedBy || req.user.id)
    });

    // Emit event to all clients via Socket.io that a new item was created
    emitToAll('item:created', item);

    // Menambah log aktivitas
    await ActivityLog.create({
      userId: req.user.id,
      action: `Add item: ${name}`,
      entityType: 'item',
      entityId: item.id,
      details: { quantity: quantityInt, categoryId: categoryIdInt }
    });

    res.status(201).json(item);

  } catch (error) {
    console.error('Failed to add item:', error.message);
    
    // Tangani error jika nomor seri / barcode duplikat
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ 
        message: "Save failed: Serial Number / Barcode already used by another item." 
      });
    }

    res.status(500).json({ message: "System error occurred", error: error.message });
  }
};


/**
 * @desc    Mengambil daftar semua barang (dengan filter dan pagination)
 * @route   GET /api/items
 * @access  Private
 */
const getItems = async (req, res) => {
  try {
    const { page = 1, limit = 10, categoryId, search, available } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (categoryId) whereClause.categoryId = categoryId;
    
    // Filter barang yang tersedia untuk dipinjam
    if (available === 'true') {
      whereClause.isAvailable = true;
      whereClause.availableQuantity = { [Op.gt]: 0 };
    }
    
    // Pencarian berdasarkan nama barang
    if (search) {
      whereClause.name = { [Op.like]: `%${search}%` };
    }

    // Mengambil data barang beserta relasi Kategori dan Manajer/Petugas
    const { count, rows: items } = await Item.findAndCountAll({
      where: whereClause,
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'managingDepartment'],
        // Petugas hanya bisa melihat barang di departemen mereka sendiri
        where: req.user.role === 'officer' ? { managingDepartment: req.user.department } : undefined,
        required: req.user.role === 'officer'
      }, {
        model: User,
        as: 'manager',
        attributes: ['id', 'fullName', 'department']
      }],
      attributes: ['id', 'name', 'description', 'categoryId', 'serialNumber', 'quantity', 'brokenQuantity', 'availableQuantity', 'condition', 'location', 'image', 'isAvailable', 'managedBy'],
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
    console.error('Failed to get items list:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Mengambil detail barang berdasarkan ID
 * @route   GET /api/items/:id
 * @access  Private/Admin,Officer
 */
const getItemById = async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name', 'description']
      }, {
        model: User,
        as: 'manager',
        attributes: ['id', 'fullName', 'department']
      }]
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    console.error('Failed to get item details:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Memperbarui data barang
 * @route   PUT /api/items/:id
 * @access  Private/Admin,Officer
 */
const updateItem = async (req, res) => {
  try {
    const {
      name,
      description,
      categoryId,
      serialNumber,
      quantity,
      brokenQuantity,
      condition,
      location,
      specifications,
      isAvailable,
      managedBy,
      image
    } = req.body;

    const quantityInt = (quantity !== undefined && quantity !== '') ? parseInt(quantity) : undefined;
    const brokenQuantityInt = (brokenQuantity !== undefined && brokenQuantity !== '') ? parseInt(brokenQuantity) : undefined;
    const categoryIdInt = (categoryId !== undefined && categoryId !== '') ? parseInt(categoryId) : undefined;

    // Parse spesifikasi jika dalam format string JSON
    let parsedSpecs = specifications;
    if (typeof specifications === 'string') {
      try {
        parsedSpecs = JSON.parse(specifications);
      } catch (e) {
        // Abaikan jika gagal parse
      }
    }

    // Parsing status ketersediaan
    let isAvailableBool = isAvailable;
    if (isAvailable === 'true') isAvailableBool = true;
    if (isAvailable === 'false') isAvailableBool = false;

    const imagePath = req.file ? `/uploads/items/${req.file.filename}` : (typeof image === 'string' ? image : undefined);

    let item = await Item.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Validasi Nomor Seri (harus unik jika berubah)
    if (serialNumber && serialNumber !== item.serialNumber) {
      const serialExists = await Item.findOne({
        where: {
          serialNumber,
          id: { [Op.ne]: item.id }
        }
      });
      if (serialExists) {
        return res.status(400).json({ message: 'Serial Number already used by another item' });
      }
    }

    const newQuantity = (quantityInt !== undefined && !isNaN(quantityInt)) ? quantityInt : item.quantity;
    let newBroken = (brokenQuantityInt !== undefined && !isNaN(brokenQuantityInt)) ? brokenQuantityInt : (item.brokenQuantity || 0);

    // Validasi agar barang rusak tidak melebihi total barang
    if (newBroken > newQuantity) {
      newBroken = newQuantity;
    }

    // Hitung secara akurat berapa barang yang benar-benar sedang dipinjam dari tabel Borrowing
    // Status yang dianggap mengurangi stok: 'approved', 'borrowed', 'overdue', 'returning'
    const borrowedAmount = await Borrowing.sum('quantity', {
      where: {
        itemId: item.id,
        status: {
          [Op.in]: ['approved', 'borrowed', 'overdue', 'returning']
        }
      }
    }) || 0;

    // Ketersediaan baru = Total Baru - Rusak Baru - Sedang Dipinjam
    let availableQuantity = newQuantity - newBroken - borrowedAmount;
    if (availableQuantity < 0) availableQuantity = 0;

    // Petugas (Officer) hanya bisa mengubah barang yang mereka kelola atau barang dalam kategori departemen mereka
    if (req.user.role === 'officer') {
      const category = await Category.findByPk(categoryIdInt || item.categoryId);
      if (!category || category.managingDepartment !== req.user.department) {
         return res.status(403).json({ message: "You are only allowed to manage items in categories from your own department" });
      }
    }

    // Melakukan update data ke database
    await item.update({
      name: name || item.name,
      description: description || item.description,
      categoryId: categoryIdInt || item.categoryId,
      serialNumber: serialNumber === '' ? null : (serialNumber || item.serialNumber),
      quantity: newQuantity,
      brokenQuantity: newBroken,
      availableQuantity,
      condition: condition || item.condition,
      location: location || item.location,
      image: imagePath !== undefined ? imagePath : item.image,
      specifications: parsedSpecs || item.specifications,
      isAvailable: isAvailableBool !== undefined ? isAvailableBool : item.isAvailable,
      managedBy: req.user.role === 'officer' ? req.user.id : (managedBy || item.managedBy)
    });

    // Menambah log aktivitas
    await ActivityLog.create({
      userId: req.user.id,
      action: `Update item: ${name || item.name}`,
      entityType: 'item',
      entityId: item.id,
      details: { quantity: item.quantity, availableQuantity: item.availableQuantity, brokenQuantity: item.brokenQuantity }
    });

    const updatedItem = await Item.findByPk(item.id, {
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name']
      }]
    });

    // Event broadcast real-time
    emitToAll('item:updated', updatedItem);

    res.json(updatedItem);
  } catch (error) {
    console.error('Failed to update item:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Menghapus barang dari inventaris
 * @route   DELETE /api/items/:id
 * @access  Private/Admin
 */
const deleteItem = async (req, res) => {
  try {
    const item = await Item.findByPk(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Petugas (Officer) hanya bisa menghapus barang yang termasuk dalam kategori departemen mereka
    if (req.user.role === 'officer') {
      const category = await Category.findByPk(item.categoryId);
      if (!category || category.managingDepartment !== req.user.department) {
        return res.status(403).json({ message: "You do not have permission to delete items from other departments" });
      }
    }

    // Hapus ketergantungan: Notifikasi dan Peminjaman terkait
    const borrowings = await Borrowing.findAll({
      where: { itemId: req.params.id },
      attributes: ['id']
    });
    const borrowingIds = borrowings.map(b => b.id);

    if (borrowingIds.length > 0) {
      await Notification.destroy({ where: { relatedBorrowingId: borrowingIds } });
    }

    await Borrowing.destroy({ where: { itemId: req.params.id } });

    // Catat log aktivitas penghapusan
    await ActivityLog.create({
      userId: req.user.id,
      action: `Delete item: ${item.name}`,
      entityType: 'item',
      entityId: item.id
    });

    // Hapus data barang secara fisik (Hard Delete)
    await item.destroy({ force: true });

    // Event broadcast real-time
    emitToAll('item:deleted', { id: req.params.id });

    res.json({ message: 'Item successfully deleted' });

  } catch (error) {
    console.error('Gagal menghapus barang:', error);
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