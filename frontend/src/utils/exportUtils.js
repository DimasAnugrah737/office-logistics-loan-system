import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * Export data to Excel (.xlsx)
 * @param {Array} data - Array of objects to export
 * @param {string} fileName - Base name of the file
 * @param {string} sheetName - Name of the worksheet
 */
export const exportToExcel = (data, fileName = 'report', sheetName = 'Data') => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fullFileName = `${fileName}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fullFileName);
};

/**
 * Export data to PDF (.pdf)
 * @param {Array} headers - Array of header strings
 * @param {Array} data - Array of arrays (rows) for the table
 * @param {string} fileName - Base name of the file
 * @param {string} title - Title to display on the PDF
 */
export const exportToPDF = (headers, data, fileName = 'report', title = 'Report') => {
    try {
        const doc = new jsPDF();

        // Add title
        doc.setFontSize(18);
        doc.text(title, 14, 22);

        // Add generation date
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 30);

        // Add table with defensive checks for jspdf-autotable
        // Some environments require autoTable(doc, options), others doc.autoTable(options)
        const finalAutoTable = autoTable.default || autoTable;

        const options = {
            head: [headers],
            body: data,
            startY: 35,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [79, 70, 229], textColor: 255 }, // Indigo-600 color
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { top: 35 },
        };

        if (typeof finalAutoTable === 'function') {
            finalAutoTable(doc, options);
        } else if (typeof doc.autoTable === 'function') {
            doc.autoTable(options);
        } else {
            console.error('jspdf-autotable not found or not initialized correctly', {
                autoTable,
                finalAutoTable,
                docHasAutoTable: !!doc.autoTable
            });
            throw new Error('PDF Table library not initialized correctly');
        }

        const fullFileName = `${fileName}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`;
        doc.save(fullFileName);
    } catch (err) {
        console.error('PDF Export Error:', err);
        throw new Error('Failed to generate PDF. Check console for details.');
    }
};
