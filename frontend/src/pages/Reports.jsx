import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../api/reports';
import { useApi } from '../hooks/useApi';
import { FiDownload, FiFileText, FiBarChart2, FiCalendar, FiPackage } from 'react-icons/fi';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';

/**
 * Reports Center Component
 * Manages the creation of borrowing reports (by date) and inventory summaries.
 * Supports PDF and Excel export formats.
 */
const Reports = () => {
  // State to store borrowing report date range (default last 30 days)
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });
  
  // State for the selected file format (pdf/excel)
  const [formatType, setFormatType] = useState('pdf');
  
  // Indicator state for an ongoing report generation process
  const [isGenerating, setIsGenerating] = useState(false);
  
  // State to store inventory summary data for UI display
  const [inventoryReport, setInventoryReport] = useState(null);

  // Custom API hooks to execute backend requests
  const { execute: generateReport } = useApi(reportsAPI.generateBorrowingReport);
  const { execute: fetchInventoryReport } = useApi(reportsAPI.getInventoryReport);

  // Fetch inventory data when the page first loads
  useEffect(() => {
    loadInventoryReport();
  }, []);

  /**
   * Fetches the latest inventory summary from the server
   */
  const loadInventoryReport = async () => {
    try {
      const data = await fetchInventoryReport();
      if (data && typeof data === 'object' && data.summary) {
        setInventoryReport(data);
      } else {
        // Fallback if data is empty
        setInventoryReport({
          summary: { totalItems: 0, totalQuantity: 0, availableItems: 0, borrowedItems: 0, categories: 0 },
          categoryStats: [],
          items: []
        });
      }
    } catch (error) {
      console.error('Failed to load inventory report:', error);
      setInventoryReport({
        summary: { totalItems: 0, totalQuantity: 0, availableItems: 0, borrowedItems: 0, categories: 0 },
        categoryStats: [],
        items: []
      });
    }
  };

  /**
   * Quick change date range (Quick Select)
   * @param {string} range - Options: today, week, month, quarter
   */
  const handleDateRangeChange = (range) => {
    const today = new Date();
    let startDate, endDate;

    switch (range) {
      case 'today':
        startDate = format(today, 'yyyy-MM-dd');
        endDate = format(today, 'yyyy-MM-dd');
        break;
      case 'week':
        startDate = format(subDays(today, 7), 'yyyy-MM-dd');
        endDate = format(today, 'yyyy-MM-dd');
        break;
      case 'month':
        startDate = format(startOfMonth(today), 'yyyy-MM-dd');
        endDate = format(endOfMonth(today), 'yyyy-MM-dd');
        break;
      case 'quarter':
        startDate = format(subDays(today, 90), 'yyyy-MM-dd');
        endDate = format(today, 'yyyy-MM-dd');
        break;
      default:
        return;
    }

    setDateRange({ startDate, endDate });
  };

  /**
   * Core Function: Download Borrowing Report
   * Sends a request to the API, receives a BLOB (binary), and triggers a browser download.
   */
  const generateBorrowingReport = async (formatType) => {
    let finalStartDate = dateRange.startDate;
    let finalEndDate = dateRange.endDate;

    if (!finalStartDate || !finalEndDate) {
      // Auto-fill safely if the user empties the input
      finalStartDate = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      finalEndDate = format(new Date(), 'yyyy-MM-dd');
      setDateRange({ startDate: finalStartDate, endDate: finalEndDate });
      toast.success('Using default date range (Last 30 Days)');
    }

    setIsGenerating(true);
    try {
      const data = {
        startDate: finalStartDate,
        endDate: finalEndDate,
        format: formatType,
      };

      const result = await generateReport(data);

      const blob = new Blob([result], {
        type: formatType === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Borrowing_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.${formatType === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully!');
    } catch (error) {
      toast.error('Failed to generate system report, please try again');
    } finally {
      setIsGenerating(false);
    }
  };


  // Directly handle Inventory Excel export
  const handleExportInventoryExcel = async () => {
    try {
      const response = await reportsAPI.getInventoryReport({ format: 'excel' });
      const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Inventory Excel report downloaded');
    } catch (error) {
      toast.error('Failed to export Excel');
    }
  };

  // Directly handle Inventory PDF export
  const handleExportInventoryPDF = async () => {
    try {
      const response = await reportsAPI.getInventoryReport({ format: 'pdf' });
      const blob = new Blob([response], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Inventory PDF report downloaded');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Reports Center</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Analyze inventory data & export reports to Excel or PDF.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Kartu 1: Laporan Peminjaman */}
        <div className="bg-white dark:bg-slate-800 rounded-none border border-gray-100 dark:border-slate-700/50 shadow-sm overflow-hidden flex flex-col">
          {/* Header Kartu */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-50 dark:border-slate-700/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-none bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <FiBarChart2 size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">Borrowing Report</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Select date range & export format</p>
              </div>
            </div>
          </div>

          {/* Isi Kartu */}
          <div className="px-8 py-6 flex-grow space-y-6">
            {/* Pemilih tanggal cepat */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quick Select</span>
              <div className="flex gap-1.5">
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'Last 7 Days' },
                  { key: 'month', label: 'This Month' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => handleDateRangeChange(key)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-none transition-all border border-gray-100 dark:border-slate-600"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Rentang Tanggal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-none p-4 border border-gray-100 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors group">
                <div className="flex items-center gap-2 mb-2">
                  <FiCalendar className="text-emerald-500 h-3.5 w-3.5" />
                  <span className="text-[9px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest">Start</span>
                </div>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="w-full bg-transparent outline-none text-sm font-bold text-gray-800 dark:text-gray-100 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
              <div className="bg-gray-50 dark:bg-slate-700/50 rounded-none p-4 border border-gray-100 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-500 transition-colors group">
                <div className="flex items-center gap-2 mb-2">
                  <FiCalendar className="text-emerald-500 h-3.5 w-3.5" />
                  <span className="text-[9px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest">End</span>
                </div>
                <input
                  type="date"
                  value={dateRange.endDate}
                  min={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="w-full bg-transparent outline-none text-sm font-bold text-gray-800 dark:text-gray-100 [color-scheme:light] dark:[color-scheme:dark]"
                />
              </div>
            </div>

          </div>

          {/* Footer Kartu */}
          <div className="px-8 pb-8 flex gap-2">
            <button
              onClick={() => generateBorrowingReport('excel')}
              className="flex-1 py-4 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-none text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/30 transition-all active:scale-95"
            >
              <FiDownload size={14} /> Excel
            </button>
            <button
              onClick={() => generateBorrowingReport('pdf')}
              className="flex-1 py-4 flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 rounded-none text-[10px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-800/30 transition-all active:scale-95"
            >
              <FiDownload size={14} /> PDF
            </button>
          </div>
        </div>

        {/* Kartu 2: Inventaris */}
        <div className="bg-white dark:bg-slate-800 rounded-none border border-gray-100 dark:border-slate-700/50 shadow-sm overflow-hidden flex flex-col">
          {/* Header Kartu */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-50 dark:border-slate-700/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-none bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <FiPackage size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">Inventory Report</h3>
                <p className="text-xs text-gray-400 font-medium mt-0.5">Current stock status summary</p>
              </div>
            </div>
          </div>

          {/* Isi Kartu */}
          <div className="px-8 py-6 flex-grow">
            {inventoryReport ? (
              <div className="space-y-5">
                {/* Kisi Statistik */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total Item Types', value: inventoryReport.summary.totalItems, color: 'text-gray-900 dark:text-white', bg: 'bg-gray-50 dark:bg-slate-700/50', border: 'border-gray-100 dark:border-slate-600' },
                    { label: 'Total Units', value: inventoryReport.summary.totalQuantity, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/30' },
                    { label: 'Available', value: inventoryReport.summary.availableItems, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-800/30' },
                    { label: 'Borrowed', value: inventoryReport.summary.borrowedItems, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/30' },
                    { label: 'Broken', value: inventoryReport.summary.brokenItems, color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-100 dark:border-rose-800/30' },
                  ].map(({ label, value, color, bg, border }) => (
                    <div key={label} className={`${bg} rounded-none p-4 border ${border}`}>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                      <p className={`text-2xl font-black ${color}`}>{value ?? 0}</p>
                    </div>
                  ))}
                </div>

                {/* Statistik Kategori */}
                {inventoryReport.categoryStats?.length > 0 && (
                  <div className="bg-gray-50 dark:bg-slate-700/30 rounded-none p-4 border border-gray-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3">By Category</p>
                    <div className="space-y-2.5">
                      {inventoryReport.categoryStats.slice(0, 4).map((stat, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-600 dark:text-gray-300 truncate max-w-[60%]">
                            {stat['category.name'] || stat.category?.name || stat.categoryName || 'Uncategorized'}
                          </span>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {stat.itemCount} <span className="text-[10px] text-gray-400 font-normal">item(s)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
              </div>
            )}
          </div>

          {/* Footer Kartu */}
          <div className="px-8 pb-8 flex gap-2">
            <button
              onClick={handleExportInventoryExcel}
              className="flex-1 py-4 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-none text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/30 transition-all active:scale-95"
            >
              <FiDownload size={14} /> Excel
            </button>
            <button
              onClick={handleExportInventoryPDF}
              className="flex-1 py-4 flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-400 rounded-none text-[10px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-800/30 transition-all active:scale-95"
            >
              <FiDownload size={14} /> PDF
            </button>
          </div>
        </div>

      </div>

      {/* Spanduk Info */}
      <div className="flex items-center gap-4 p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-none border border-emerald-100 dark:border-emerald-800/30">
        <div className="w-10 h-10 rounded-none bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-emerald-500 flex-shrink-0">
          <FiFileText size={18} />
        </div>
        <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 font-medium leading-relaxed">
          Excel reports contain raw data that can be filtered manually. Ensure the date range is correct before downloading.
        </p>
      </div>
    </div>
  );
};

export default Reports;
