const Item = require('../models/Item');
const Category = require('../models/Category');
const Borrowing = require('../models/Borrowing');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * @desc    Generate borrowing report in JSON, Excel, or PDF format
 * @route   POST/GET /api/reports/borrowings
 * @access  Private/Admin,Officer
 */
const generateBorrowingReport = async (req, res) => {
  try {
    // Extract dates and format from body (POST) or query (GET)
    const body = req.method === 'POST' ? req.body : req.query;
    const startDate = body.startDate;
    const endDate = body.endDate;
    const format = body.format || 'json';

    // Build search criteria (where clause) based on date range
    const whereClause = {};
    if (startDate || endDate) {
      whereClause.borrowDate = {};

      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          whereClause.borrowDate[Op.gte] = start;
        }
      }

      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          whereClause.borrowDate[Op.lte] = end;
        }
      }

      // Remove date filter if the object is empty
      const hasFilters = Object.getOwnPropertySymbols(whereClause.borrowDate).length > 0 ||
        Object.keys(whereClause.borrowDate).length > 0;

      if (!hasFilters) {
        delete whereClause.borrowDate;
      }
    }

    // Define data relations to be fetched (User, Item, Category)
    const includeClause = [
      { model: User, as: 'user', attributes: ['fullName', 'email', 'nip', 'department'] },
      {
        model: Item,
        as: 'item',
        attributes: ['id', 'name', 'serialNumber', 'categoryId'],
        include: [{ model: Category, as: 'category', attributes: ['name', 'managingDepartment'] }]
      },
      { model: User, as: 'approverUser', attributes: ['fullName'] }
    ];

    // Department Filter: Officers can only see reports in their department
    if (req.user.role === 'officer') {
      whereClause['$item.category.managingDepartment$'] = req.user.department;
    }

    // Fetch borrowing data from database
    const borrowings = await Borrowing.findAll({
      where: whereClause,
      include: includeClause,
      order: [['createdAt', 'DESC']]
    });

    // Calculate item popularity for report sorting
    const popularityMap = {};
    borrowings.forEach(b => {
      const itemId = b.item?.id || 0;
      popularityMap[itemId] = (popularityMap[itemId] || 0) + 1;
    });

    // Sort data: Category (A-Z) -> Most Popular -> Item Name
    const sortedBorrowings = borrowings.sort((a, b) => {
      const catA = a.item?.category?.name || 'Uncategorized';
      const catB = b.item?.category?.name || 'Uncategorized';

      if (catA !== catB) return catA.localeCompare(catB);

      const popA = popularityMap[a.item?.id] || 0;
      const popB = popularityMap[b.item?.id] || 0;

      if (popA !== popB) return popB - popA;

      const nameA = a.item?.name || '';
      const nameB = b.item?.name || '';
      return nameA.localeCompare(nameB);
    });

    // --- FORMAL EXCEL GENERATION ---
    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Borrowing Report');

      // Define report theme colors
      const primaryColor = 'FF4F46E5';
      const headerBg = 'FF1E293B';
      const borderColor = 'FFE2E8F0';
      const alternateRowColor = 'FFF8FAFC';

      // Report Title Header
      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'BORROWING REPORT';
      titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      worksheet.mergeCells('A2:J2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = `Period: ${startDate || 'All Time'} to ${endDate || 'Now'}`;
      subtitleCell.font = { size: 11, italic: true, color: { argb: 'FF64748B' } };
      subtitleCell.alignment = { horizontal: 'center' };
      worksheet.getRow(2).height = 25;

      const deptLine = req.user.role === 'officer' ? `Department: ${req.user.department}` : 'Access: Administrator (Global)';
      worksheet.mergeCells('A3:J3');
      const deptCell = worksheet.getCell('A3');
      deptCell.value = deptLine;
      deptCell.font = { size: 10, bold: true, color: { argb: 'FF475569' } };
      deptCell.alignment = { horizontal: 'center' };

      worksheet.addRow([]); // Empty row

      // Table Header
      const headerRow = worksheet.addRow([
        'SERIAL NUMBER', 'CATEGORY', 'ITEM NAME', 'BORROWER', 'UNIT/DEPT', 'QTY', 'STATUS', 'BORROW DATE', 'RETURN DATE', 'MANAGER'
      ]);

      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'medium', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });

      // Fill Data to Excel Rows
      sortedBorrowings.forEach((b, index) => {
        const row = worksheet.addRow([
          b.item?.serialNumber ? `# ${b.item.serialNumber}` : '-',
          b.item?.category?.name || '-',
          b.item?.name || '-',
          b.user?.fullName || '-',
          b.user?.department || '-',
          b.quantity,
          b.status.toUpperCase(),
          b.borrowDate ? new Date(b.borrowDate).toLocaleDateString() : '-',
          b.actualReturnDate ? new Date(b.actualReturnDate).toLocaleDateString() : '-',
          b.item?.category?.managingDepartment || '-'
        ]);

        row.height = 25;
        row.eachCell(cell => {
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: borderColor } },
            left: { style: 'thin', color: { argb: borderColor } },
            bottom: { style: 'thin', color: { argb: borderColor } },
            right: { style: 'thin', color: { argb: borderColor } }
          };
          // Alternating row effect (Zebra)
          if (index % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: alternateRowColor } };
          }
        });

        // Color STATUS column based on value (Borrowed, Pending, Overdue)
        const statusCell = row.getCell(7); // Column index 7 is STATUS
        let statusColor = 'FF475569';
        if (b.status === 'borrowed') statusColor = 'FF059669';
        else if (b.status === 'pending') statusColor = 'FFD97706';
        else if (b.status === 'overdue') statusColor = 'FFDC2626';

        statusCell.font = { bold: true, color: { argb: statusColor }, size: 9 };
      });

      // Add summary table at the bottom
      worksheet.addRow([]);

      const summaryStartRow = worksheet.lastRow.number + 1;
      worksheet.mergeCells(`A${summaryStartRow}:B${summaryStartRow}`);
      const summaryHeader = worksheet.getCell(`A${summaryStartRow}`);
      summaryHeader.value = 'REPORT SUMMARY';
      summaryHeader.font = { bold: true, size: 12, color: { argb: primaryColor } };

      worksheet.addRow(['Total Transactions', sortedBorrowings.length]);
      worksheet.addRow(['Total Items Borrowed', sortedBorrowings.reduce((s, b) => s + b.quantity, 0)]);

      // Column width configuration and freeze panes
      worksheet.columns = [
        { width: 18 }, { width: 18 }, { width: 30 }, { width: 22 }, { width: 18 }, { width: 8 }, { width: 12 }, { width: 18 }, { width: 18 }, { width: 18 }
      ];
      worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 5 }];

      // Send file as download (Buffer)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Borrowing_Report_${new Date().getTime()}.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();

    } else if (format === 'pdf') {
      // --- PREMIUM PDF GENERATION ---
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Borrowing_Report_${new Date().getTime()}.pdf"`);
      doc.pipe(res);

      // Card-style dark header
      doc.rect(0, 0, 600, 100).fill('#1e293b');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('BORROWING REPORT', 40, 35);
      doc.fontSize(10).font('Helvetica').text('OFFICE EQUIPMENT MANAGEMENT SYSTEM', 40, 60);

      const deptLine = req.user.role === 'officer' ? `Department: ${req.user.department}` : 'Access: Administrator (Global)';
      doc.fontSize(9).text(deptLine, 40, 75);

      doc.fillColor('#ffffff').fontSize(8).text(`Printed: ${new Date().toLocaleString()}`, 350, 40, { align: 'right', width: 200 });

      // PDF Table Header
      const tableTop = 175;
      doc.fillColor('#f1f5f9').rect(40, tableTop, 515, 20).fill();
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(7);
      doc.text('SERIAL NUMBER', 45, tableTop + 6, { width: 75 });
      doc.text('ITEM NAME', 125, tableTop + 6, { width: 95 });
      doc.text('BORROWER', 225, tableTop + 6, { width: 85 });
      doc.text('STATUS', 315, tableTop + 6, { width: 50, align: 'center' });
      doc.text('BORROW DATE', 370, tableTop + 6, { width: 60, align: 'center' });
      doc.text('RETURN DATE', 435, tableTop + 6, { width: 60, align: 'center' });
      doc.text('MANAGER', 500, tableTop + 6, { width: 55 });

      let currentY = tableTop + 20;

      // Iterate borrowing data into PDF table rows
      sortedBorrowings.forEach((b, index) => {
        if (currentY > 750) { doc.addPage(); currentY = 50; }
        if (index % 2 === 1) doc.fillColor('#f8fafc').rect(40, currentY, 515, 25).fill();

        doc.fillColor('#1e293b').font('Helvetica').fontSize(7);
        doc.text(b.item?.serialNumber ? `# ${b.item.serialNumber}` : '-', 45, currentY + 8, { width: 75, truncate: true });
        doc.font('Helvetica-Bold').text(b.item?.name || '-', 125, currentY + 8, { width: 95, truncate: true });
        doc.font('Helvetica').text(b.user?.fullName || '-', 225, currentY + 8, { width: 85, truncate: true });

        // Status coloring in PDF
        let statusHex = '#64748b';
        if (b.status === 'borrowed') statusHex = '#059669';
        else if (b.status === 'overdue') statusHex = '#dc2626';
        else if (b.status === 'pending') statusHex = '#d97706';

        doc.fillColor(statusHex).font('Helvetica-Bold').text(b.status.toUpperCase(), 315, currentY + 8, { width: 50, align: 'center' });

        doc.fillColor('#475569').font('Helvetica').text(b.borrowDate ? new Date(b.borrowDate).toLocaleDateString() : '-', 370, currentY + 8, { width: 60, align: 'center' });
        doc.text(b.actualReturnDate ? new Date(b.actualReturnDate).toLocaleDateString() : '-', 435, currentY + 8, { width: 60, align: 'center' });
        doc.text(b.item?.category?.managingDepartment || '-', 500, currentY + 8, { width: 55, truncate: true });

        currentY += 25;
      });

      doc.end();
    } else {
      // Default: Send data in JSON format
      res.json({ message: 'Report generated', data: sortedBorrowings });
    }
  } catch (error) {
    console.error('Failed to generate report:', error.message);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

/**
 * @desc    Get system activity logs with various filters
 * @route   GET /api/reports/activity-logs
 * @access  Private/Admin
 */
const getActivityLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { search, userId, action, startDate, endDate } = req.query;

    const whereClause = {};

    // Filter by User ID
    if (userId && userId !== 'all') {
      whereClause.userId = userId;
    }

    // Filter by Action Type (Create, Update, Delete, etc.)
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

    // Date Range Filter
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt[Op.lte] = end;
      }
    }

    // Run query with user search (via Include)
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
      total: count,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('Failed to get activity logs:', error.message);
    res.status(500).json({ message: 'System error occurred' });
  }
};

/**
 * @desc    Generate current inventory status report
 * @route   GET /api/reports/inventory
 * @access  Private/Admin,Officer
 */
const getInventoryReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const categoryWhere = {};
    if (req.user.role === 'officer') {
      categoryWhere.managingDepartment = req.user.department;
    }

    // Fetch all items with category stats
    const items = await Item.findAll({
      attributes: ['id', 'name', 'serialNumber', 'description', 'categoryId', 'quantity', 'availableQuantity', 'brokenQuantity', 'condition', 'location', 'image', 'isAvailable', 'createdBy', 'managedBy', 'createdAt', 'updatedAt'],
      include: [{
        model: Category,
        as: 'category',
        attributes: ['name', 'managingDepartment'],
        where: categoryWhere,
        required: req.user.role === 'officer'
      }],
      order: [['categoryId', 'ASC'], ['name', 'ASC']]
    });

    // Calculate statistical summary
    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const availableItems = items.reduce((sum, item) => sum + item.availableQuantity, 0);
    const brokenItemsCount = items.reduce((sum, item) => sum + (item.brokenQuantity || 0), 0);
    
    // Borrowed items calculation must account for the actual borrowed amount in formula
    // availableQuantity = quantity - brokenQuantity - borrowed
    // So borrowed = quantity - brokenQuantity - availableQuantity
    const borrowedItems = items.reduce((sum, item) => {
      const borrowed = item.quantity - (item.brokenQuantity || 0) - item.availableQuantity;
      return sum + Math.max(0, borrowed);
    }, 0);

    // Category Stats using Database Aggregation
    const categoryStats = await Item.findAll({
      attributes: [
        [Sequelize.col('Item.categoryId'), 'categoryId'],
        [Sequelize.fn('COUNT', Sequelize.col('Item.id')), 'itemCount'],
        [Sequelize.fn('SUM', Sequelize.col('Item.quantity')), 'totalQuantity'],
        [Sequelize.fn('SUM', Sequelize.col('Item.availableQuantity')), 'availableQuantity']
      ],
      include: [{
        model: Category, as: 'category', attributes: ['name'], where: categoryWhere, required: req.user.role === 'officer'
      }],
      group: ['Item.categoryId', 'category.id', 'category.name'],
      raw: true,
      nest: true
    });

    // --- EXCEL GENERATION FOR INVENTORY ---
    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Inventory Report');

      // Color Styling
      const headerBg = 'FF1E293B';
      const alternateRowColor = 'FFF8FAFC';
      const borderColor = 'FFE2E8F0';

      // Title Header
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'OFFICE EQUIPMENT INVENTORY REPORT';
      titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      worksheet.addRow([]); // Empty row

      // Table Column Titles
      const headerRow = worksheet.addRow(['SERIAL NUMBER', 'ITEM NAME', 'CATEGORY', 'TOTAL STOCK', 'AVAILABLE', 'STATUS']);
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'medium' }, right: { style: 'thin' }
        };
      });

      // Fill Item Data
      items.forEach((item, index) => {
        const row = worksheet.addRow([
          item.serialNumber ? `# ${item.serialNumber}` : '-',
          item.name,
          item.category?.name || '-',
          item.quantity,
          item.availableQuantity,
          item.availableQuantity > 0 ? 'AVAILABLE' : 'OUT OF STOCK'
        ]);

        row.height = 25;
        row.eachCell((cell, colIndex) => {
          cell.alignment = { vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: borderColor } },
            left: { style: 'thin', color: { argb: borderColor } },
            bottom: { style: 'thin', color: { argb: borderColor } },
            right: { style: 'thin', color: { argb: borderColor } }
          };
          if (index % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: alternateRowColor } };
          }

          // Color Status
          if (colIndex === 6) {
            const isAvail = cell.value === 'AVAILABLE';
            cell.font = { bold: true, color: { argb: isAvail ? 'FF059669' : 'FFDC2626' }, size: 9 };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
      });

      // Column Width Settings
      worksheet.columns = [
        { width: 20 }, { width: 40 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 20 }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Inventory_Report_${new Date().getTime()}.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();

    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Inventory_Report_${new Date().getTime()}.pdf"`);
      doc.pipe(res);

      // Card Header
      doc.rect(0, 0, 600, 100).fill('#1e293b');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('INVENTORY STOCK REPORT', 40, 35);
      doc.fontSize(9).font('Helvetica').text(`Total Items: ${totalItems} | Total Units: ${totalQuantity} | Available: ${availableItems}`, 40, 65);
      doc.fontSize(8).text(`Printed: ${new Date().toLocaleString()}`, 400, 40, { align: 'right', width: 150 });

      // PDF Table Header
      const tableTop = 150;
      doc.fillColor('#f1f5f9').rect(40, tableTop, 515, 20).fill();
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
      doc.text('SERIAL NUMBER', 45, tableTop + 6, { width: 85 });
      doc.text('ITEM NAME', 135, tableTop + 6, { width: 170 });
      doc.text('CATEGORY', 310, tableTop + 6, { width: 85 });
      doc.text('STOCK', 400, tableTop + 6, { width: 35, align: 'center' });
      doc.text('REM.', 440, tableTop + 6, { width: 35, align: 'center' });
      doc.text('AVAILABILITY', 480, tableTop + 6, { width: 75, align: 'center' });

      let currentY = tableTop + 20;

      // Iterate Items to PDF
      items.forEach((item, index) => {
        if (currentY > 750) { doc.addPage(); currentY = 50; }
        if (index % 2 === 1) doc.fillColor('#f8fafc').rect(40, currentY, 515, 25).fill();

        doc.fillColor('#1e293b').font('Helvetica').fontSize(8);
        doc.text(item.serialNumber ? `# ${item.serialNumber}` : '-', 45, currentY + 8, { width: 85, truncate: true });
        doc.font('Helvetica-Bold').text(item.name || '-', 135, currentY + 8, { width: 170, truncate: true });
        doc.font('Helvetica').text(item.category?.name || '-', 310, currentY + 8, { width: 85, truncate: true });
        doc.text(item.quantity.toString(), 400, currentY + 8, { width: 35, align: 'center' });
        doc.text(item.availableQuantity.toString(), 440, currentY + 8, { width: 35, align: 'center' });

        const isAvail = item.availableQuantity > 0;
        doc.fillColor(isAvail ? '#059669' : '#dc2626').font('Helvetica-Bold').text(isAvail ? 'AVAILABLE' : 'OUT STOCK', 480, currentY + 8, { width: 75, align: 'center' });

        currentY += 25;
      });

      doc.end();
    } else {
      // Default JSON Response
      res.json({
        summary: { totalItems, totalQuantity, availableItems, borrowedItems, brokenItems: brokenItemsCount },
        categoryStats,
        items
      });
    }
  } catch (error) {
    console.error('Failed to get inventory report:', error);
    res.status(500).json({ message: 'System error occurred', error: error.message });
  }
};

module.exports = {
  generateBorrowingReport,
  getActivityLogs,
  getInventoryReport
};