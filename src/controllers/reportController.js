const Borrowing = require('../models/Borrowing');
const Item = require('../models/Item');
const User = require('../models/User');
const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');
const { Op, Sequelize } = require('sequelize');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const generateBorrowingReport = async (req, res) => {
  try {
    // Extract dates and format from body or query with fallback
    const body = req.method === 'POST' ? req.body : req.query;
    const startDate = body.startDate;
    const endDate = body.endDate;
    const format = body.format || 'json';

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

      // Check if any operators (Symbols) or keys were added
      const hasFilters = Object.getOwnPropertySymbols(whereClause.borrowDate).length > 0 ||
        Object.keys(whereClause.borrowDate).length > 0;

      if (!hasFilters) {
        delete whereClause.borrowDate;
      }
    }

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

    // Filter by department for Officers
    if (req.user.role === 'officer') {
      whereClause['$item.category.managingDepartment$'] = req.user.department;
    }

    const borrowings = await Borrowing.findAll({
      where: whereClause,
      include: includeClause,
      order: [['createdAt', 'DESC']]
    });

    // Calculate popularity counts per item
    const popularityMap = {};
    borrowings.forEach(b => {
      const itemId = b.item?.id || 0;
      popularityMap[itemId] = (popularityMap[itemId] || 0) + 1;
    });

    // Sort borrowings: Category Name (ASC), Popularity (DESC), Item Name (ASC)
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

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan Peminjaman');

      // Style constants
      const primaryColor = 'FF4F46E5'; // Indigo-600
      const headerBg = 'FF1E293B';    // Slate-100/Dark-900 
      const borderColor = 'FFE2E8F0'; // Slate-200
      const alternateRowColor = 'FFF8FAFC'; // Slate-50

      // Title Section
      worksheet.mergeCells('A1:J1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'LAPORAN PEMINJAMAN PERALATAN KANTOR';
      titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      worksheet.mergeCells('A2:J2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = `Periode: ${startDate || 'Semua Waktu'} s/d ${endDate || 'Sekarang'}`;
      subtitleCell.font = { size: 11, italic: true, color: { argb: 'FF64748B' } };
      subtitleCell.alignment = { horizontal: 'center' };
      worksheet.getRow(2).height = 25;

      const deptLine = req.user.role === 'officer' ? `Departemen: ${req.user.department}` : 'Akses: Administrator (Global)';
      worksheet.mergeCells('A3:J3');
      const deptCell = worksheet.getCell('A3');
      deptCell.value = deptLine;
      deptCell.font = { size: 10, bold: true, color: { argb: 'FF475569' } };
      deptCell.alignment = { horizontal: 'center' };
      
      worksheet.addRow([]); // Gap row
      
      // Header Row (Now on Row 5)
      const headerRow = worksheet.addRow([
        'ID', 
        'KATEGORI', 
        'NAMA BARANG', 
        'NOMOR SERI', 
        'PEMINJAM', 
        'UNIT/DEPT', 
        'QTY', 
        'STATUS', 
        'TANGGAL PINJAM', 
        'PENGELOLA'
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

      // Rows Data
      sortedBorrowings.forEach((b, index) => {
        const row = worksheet.addRow([
          b.id,
          b.item?.category?.name || '-',
          b.item?.name || '-',
          b.item?.serialNumber || '-',
          b.user?.fullName || '-',
          b.user?.department || '-',
          b.quantity,
          b.status.toUpperCase(),
          b.borrowDate ? new Date(b.borrowDate).toLocaleDateString('id-ID') : '-',
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
          if (index % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: alternateRowColor } };
          }
        });

        // Center specific columns
        [1, 7, 8, 9].forEach(colIndex => {
          row.getCell(colIndex).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Status coloring
        const statusCell = row.getCell(8);
        let statusColor = 'FF475569'; // Default gray
        if (b.status === 'borrowed') statusColor = 'FF059669'; // Emerald
        else if (b.status === 'pending') statusColor = 'FFD97706'; // Amber
        else if (b.status === 'overdue') statusColor = 'FFDC2626'; // Red
        
        statusCell.font = { bold: true, color: { argb: statusColor }, size: 9 };
      });

      // Summary Table after data
      worksheet.addRow([]);
      worksheet.addRow([]);
      
      const summaryStartRow = worksheet.lastRow.number;
      worksheet.mergeCells(`A${summaryStartRow}:B${summaryStartRow}`);
      const summaryHeader = worksheet.getCell(`A${summaryStartRow}`);
      summaryHeader.value = 'RINGKASAN LAPORAN';
      summaryHeader.font = { bold: true, size: 12, color: { argb: primaryColor } };
      summaryHeader.alignment = { horizontal: 'left' };

      const totalRow = worksheet.addRow(['Total Transaksi', sortedBorrowings.length]);
      totalRow.getCell(1).font = { bold: true };
      
      const qtyRow = worksheet.addRow(['Total Barang Dipinjam', sortedBorrowings.reduce((s, b) => s + b.quantity, 0)]);
      qtyRow.getCell(1).font = { bold: true };

      // Add border to summary section
      for (let i = summaryStartRow; i <= worksheet.lastRow.number; i++) {
        worksheet.getRow(i).getCell(1).border = { left: { style: 'medium', color: { argb: primaryColor } } };
      }

      // Column widths and auto-filtering
      worksheet.columns = [
        { width: 8 },  // ID
        { width: 20 }, // Category
        { width: 35 }, // Item Name
        { width: 18 }, // S/N
        { width: 25 }, // Borrower
        { width: 20 }, // Dept
        { width: 10 }, // Qty
        { width: 15 }, // Status
        { width: 20 }, // Date
        { width: 20 }  // Pengelola
      ];

      // Enable AutoFilter on the data table
      worksheet.autoFilter = `A5:J${worksheet.lastRow.number - 5}`;
      
      // Freeze the top rows (header and above)
      worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 5, activePane: 'bottomRight', selType: 'row' }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Laporan_Peminjaman_${new Date().getTime()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Laporan_Peminjaman_${new Date().getTime()}.pdf`);
      doc.pipe(res);

      // --- Header ---
      doc.rect(0, 0, 600, 100).fill('#1e293b');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('LAPORAN PEMINJAMAN', 40, 35);
      doc.fontSize(10).font('Helvetica').text('SISTEM INVENTARIS PERALATAN KANTOR', 40, 60);

      const deptLine = req.user.role === 'officer' ? `Departemen: ${req.user.department}` : 'Akses: Administrator (Global)';
      doc.fontSize(9).text(deptLine, 40, 75);
      
      doc.fillColor('#ffffff').fontSize(8).text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 350, 40, { align: 'right', width: 200 });
      doc.text(`Periode: ${startDate || 'Awal'} - ${endDate || 'Selesai'}`, 350, 55, { align: 'right', width: 200 });

      doc.moveDown(6);
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(14).text('Data Transaksi', 40, 140);
      doc.rect(40, 158, 50, 2).fill('#2563eb');

      doc.y = 175;

      // Table Header
      const tableTop = doc.y;
      doc.fillColor('#f1f5f9').rect(40, tableTop, 515, 20).fill();
      doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
      doc.text('ID', 45, tableTop + 6, { width: 30 });
      doc.text('NAMA BARANG', 80, tableTop + 6, { width: 140 });
      doc.text('PEMINJAM', 225, tableTop + 6, { width: 100 });
      doc.text('STATUS', 330, tableTop + 6, { width: 60 });
      doc.text('TGL PINJAM', 395, tableTop + 6, { width: 65 });
      doc.text('PENGELOLA', 465, tableTop + 6, { width: 90 });

      let currentY = tableTop + 20;

      sortedBorrowings.forEach((b, index) => {
        // Page break logic
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }

        // Stripe effect
        if (index % 2 === 1) {
          doc.fillColor('#f8fafc').rect(40, currentY, 515, 25).fill();
        }

        doc.fillColor('#1e293b').font('Helvetica').fontSize(8);
        doc.text(`#${b.id}`, 45, currentY + 8);
        doc.font('Helvetica-Bold').text(b.item?.name || '-', 80, currentY + 8, { width: 140, lineBreak: false });
        doc.font('Helvetica').text(b.user?.fullName || '-', 225, currentY + 8, { width: 100 });
        
        // Status with color logic
        let statusHex = '#64748b';
        if (b.status === 'borrowed') statusHex = '#059669';
        else if (b.status === 'overdue') statusHex = '#dc2626';
        else if (b.status === 'pending') statusHex = '#d97706';
        
        doc.fillColor(statusHex).font('Helvetica-Bold').text(b.status.toUpperCase(), 330, currentY + 8);
        
        doc.fillColor('#475569').font('Helvetica').text(b.borrowDate ? new Date(b.borrowDate).toLocaleDateString('id-ID') : '-', 395, currentY + 8);
        doc.text(b.item?.category?.managingDepartment || '-', 465, currentY + 8, { width: 90 });

        currentY += 25;
        doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
      });

      // Footer Summary
      doc.moveAround = currentY + 40;
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(10).text(`Total Transaksi: ${sortedBorrowings.length}`, 40, currentY + 30);
      doc.text(`Total Unit Terpakai: ${sortedBorrowings.reduce((s, b) => s + b.quantity, 0)}`, 40, currentY + 45);

      doc.end();
    } else {
      res.json({ message: 'Report generated', data: sortedBorrowings });
    }
  } catch (error) {
    console.error('Generate report error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

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

    // Filter by Action Type
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

    // Filter by Date Range
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

    // Search by User Name or Action via Include
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
        required: search ? true : false // If searching for user, only return logs with that user
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

const getInventoryReport = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const itemWhere = {};
    const categoryWhere = {};
    
    // Filter by department for Officers
    if (req.user.role === 'officer') {
      categoryWhere.managingDepartment = req.user.department;
    }

    const items = await Item.findAll({
      where: itemWhere,
      include: [{ 
        model: Category, 
        as: 'category', 
        attributes: ['name', 'managingDepartment'],
        where: categoryWhere,
        required: req.user.role === 'officer'
      }],
      order: [['categoryId', 'ASC'], ['name', 'ASC']]
    });

    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const availableItems = items.filter(i => i.isAvailable).length;
    const borrowedItems = items.reduce((sum, item) => sum + (item.quantity - item.availableQuantity), 0);
    const categoriesCount = await Category.count({
      where: categoryWhere
    });

    // Category stats
    const categoryStats = await Item.findAll({
      attributes: [
        'categoryId',
        [Sequelize.fn('COUNT', Sequelize.col('Item.id')), 'itemCount'],
        [Sequelize.fn('SUM', Sequelize.col('quantity')), 'totalQuantity'],
        [Sequelize.fn('SUM', Sequelize.col('availableQuantity')), 'availableQuantity']
      ],
      include: [{ 
        model: Category, 
        as: 'category', 
        attributes: ['name', 'managingDepartment'],
        where: categoryWhere,
        required: req.user.role === 'officer'
      }],
      group: ['categoryId', 'category.id', 'category.name', 'category.managingDepartment'],
      raw: true,
      nest: true
    });

    const summary = {
      totalItems,
      totalQuantity,
      availableItems,
      borrowedItems,
      categories: categoriesCount
    };

    const formattedCategoryStats = categoryStats.map(c => ({
      categoryName: c.category?.name || 'Uncategorized',
      itemCount: parseInt(c.itemCount) || 0,
      totalQuantity: parseInt(c.totalQuantity) || 0,
      availableQuantity: parseInt(c.availableQuantity) || 0
    }));

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Laporan Inventaris');

      // Style constants
      const primaryColor = 'FF4F46E5'; // Indigo-600
      const headerBg = 'FF1E293B';    // Slate-100/Dark-900 
      const borderColor = 'FFE2E8F0'; // Slate-200
      const alternateRowColor = 'FFF8FAFC'; // Slate-50

      // Header Premium
      worksheet.mergeCells('A1:H1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'LAPORAN INVENTARIS PERALATAN';
      titleCell.font = { size: 16, bold: true, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 40;

      worksheet.mergeCells('A2:H2');
      const subtitleCell = worksheet.getCell('A2');
      subtitleCell.value = `Dicetak pada: ${new Date().toLocaleString('id-ID')}`;
      subtitleCell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
      subtitleCell.alignment = { horizontal: 'center' };
      worksheet.getRow(2).height = 25;

      worksheet.addRow([]); // Blank
      
      // Summary Info Row
      const summaryRow = worksheet.addRow([
        'Total Barang:', totalItems, 
        'Total Unit:', totalQuantity, 
        'Tersedia:', availableItems, 
        'Terpinjam:', borrowedItems
      ]);
      summaryRow.height = 25;
      [1, 3, 5, 7].forEach(idx => {
        summaryRow.getCell(idx).font = { bold: true, color: { argb: 'FF475569' } };
        summaryRow.getCell(idx+1).font = { bold: true, color: { argb: primaryColor } };
      });

      worksheet.addRow([]); // Blank

      const headerRow = worksheet.addRow([
        'ID', 
        'NAMA BARANG', 
        'KATEGORI', 
        'DEPARTEMEN PENGELOLA', 
        'KONDISI', 
        'STOK TOTAL', 
        'TERSEDIA', 
        'STATUS'
      ]);
      
      headerRow.height = 30;
      headerRow.eachCell(cell => {
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

      items.forEach((item, idx) => {
        const row = worksheet.addRow([
          item.id,
          item.name,
          item.category?.name || '-',
          item.category?.managingDepartment || '-',
          item.condition.toUpperCase(),
          item.quantity,
          item.availableQuantity,
          item.isAvailable ? 'TERSEDIA' : 'TIDAK TERSEDIA'
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
          
          if (idx % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: alternateRowColor } };
          }
        });

        // Center specific columns
        [1, 5, 6, 7, 8].forEach(colIndex => {
          row.getCell(colIndex).alignment = { horizontal: 'center', vertical: 'middle' };
        });

        const statusCell = row.getCell(8);
        statusCell.font = { bold: true, color: { argb: item.isAvailable ? 'FF059669' : 'FFDC2626' }, size: 9 };
      });

      worksheet.columns = [
        { width: 8 },  // ID
        { width: 35 }, // Name
        { width: 22 }, // Category
        { width: 25 }, // Dept
        { width: 15 }, // Condition
        { width: 12 }, // Total
        { width: 12 }, // Available
        { width: 20 }  // Status
      ];

      // Enable AutoFilter
      worksheet.autoFilter = `A6:H${worksheet.lastRow.number}`;
      
      // Freeze header
      worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 6, activePane: 'bottomRight', selType: 'row' }
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Laporan_Inventaris_${new Date().getTime()}.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Laporan_Inventaris_${new Date().getTime()}.pdf`);
      doc.pipe(res);

      // Header
      doc.rect(0, 0, 600, 80).fill('#1e293b');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text('LAPORAN INVENTARIS', 40, 30);
      doc.fontSize(8).font('Helvetica').text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, 350, 35, { align: 'right', width: 200 });

      doc.y = 120;

      // Stats Summary Cards
      const startX = 40;
      doc.fillColor('#f8fafc').rect(startX, doc.y, 515, 50).fill();
      doc.fillColor('#64748b').font('Helvetica').fontSize(8);
      doc.text('TOTAL BARANG', startX + 20, doc.y + 15);
      doc.text('TOTAL UNIT', startX + 150, doc.y - 8);
      doc.text('TERSEDIA', startX + 280, doc.y - 8);
      doc.text('TERPINJAM', startX + 410, doc.y - 8);
      
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(14);
      doc.text(totalItems, startX + 20, doc.y + 15);
      doc.text(totalQuantity, startX + 150, doc.y - 14);
      doc.text(availableItems, startX + 280, doc.y - 14);
      doc.text(borrowedItems, startX + 410, doc.y - 14);

      doc.moveDown(3);

      // Table
      const tableTop = doc.y;
      doc.fillColor('#1e293b').rect(40, tableTop, 515, 20).fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      doc.text('NAMA BARANG', 45, tableTop + 6, { width: 180 });
      doc.text('KATEGORI', 230, tableTop + 6, { width: 100 });
      doc.text('PENGELOLA', 335, tableTop + 6, { width: 85 });
      doc.text('STOK', 425, tableTop + 6, { width: 40 });
      doc.text('STATUS', 475, tableTop + 6, { width: 80 });

      let currentY = tableTop + 20;

      items.forEach((item, index) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
        }

        if (index % 2 === 1) doc.fillColor('#f8fafc').rect(40, currentY, 515, 25).fill();

        doc.fillColor('#1e293b').font('Helvetica').fontSize(8);
        doc.text(item.name, 45, currentY + 8, { width: 180, lineBreak: false });
        doc.text(item.category?.name || '-', 230, currentY + 8, { width: 100 });
        doc.text(item.category?.managingDepartment || '-', 335, currentY + 8, { width: 85 });
        doc.text(`${item.availableQuantity}/${item.quantity}`, 425, currentY + 8);

        const statusColor = item.isAvailable ? '#059669' : '#dc2626';
        doc.fillColor(statusColor).font('Helvetica-Bold').text(item.isAvailable ? 'TERSEDIA' : 'PENUH', 475, currentY + 8);

        currentY += 25;
        doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#f1f5f9').lineWidth(0.5).stroke();
      });

      doc.end();
    } else {
      res.json({
        summary,
        categoryStats: formattedCategoryStats,
        conditionStats: [],
        items: items.map(i => ({
          id: i.id,
          name: i.name,
          category: i.category?.name || 'N/A',
          quantity: i.quantity,
          availableQuantity: i.availableQuantity,
          status: i.isAvailable ? 'Available' : 'Unavailable',
          condition: i.condition
        }))
      });
    }
  } catch (error) {
    console.error('Get inventory report error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  generateBorrowingReport,
  getActivityLogs,
  getInventoryReport
};