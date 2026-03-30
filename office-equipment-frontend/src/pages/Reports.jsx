import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../api/reports';
import { useApi } from '../hooks/useApi';
import { FiDownload, FiFileText, FiBarChart2, FiCalendar, FiPackage } from 'react-icons/fi';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';

const Reports = () => {
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [formatType, setFormatType] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [inventoryReport, setInventoryReport] = useState(null);

  const { execute: generateReport } = useApi(reportsAPI.generateBorrowingReport);
  const { execute: fetchInventoryReport } = useApi(reportsAPI.getInventoryReport);

  useEffect(() => {
    loadInventoryReport();
  }, []);

  const loadInventoryReport = async () => {
    try {
      const data = await fetchInventoryReport();
      if (data && typeof data === 'object' && data.summary) {
        setInventoryReport(data);
      } else {
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

  const generateBorrowingReport = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      toast.error('Silakan pilih rentang tanggal');
      return;
    }

    setIsGenerating(true);
    try {
      const data = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
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
      link.setAttribute('download', `borrowing_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.${formatType === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Laporan berhasil diunduh');
    } catch (error) {
      toast.error('Gagal membuat laporan');
    } finally {
      setIsGenerating(false);
    }
  };

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
      toast.success('Laporan Excel inventaris diunduh');
    } catch (error) {
      toast.error('Gagal mengekspor Excel');
    }
  };

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
      toast.success('Laporan PDF inventaris diunduh');
    } catch (error) {
      toast.error('Gagal mengekspor PDF');
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Pusat Laporan</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Analisis data, statistik inventaris, dan ekspor laporan resmi ke Excel atau PDF.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Laporan Peminjaman */}
        <div className="card h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center mb-6">
              <div className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 mr-4">
                <FiBarChart2 className="h-6 w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Ekspor Data Peminjaman</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">Rentang tanggal kustom untuk ekspor laporan</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Rentang Tanggal</label>
                <div className="flex gap-1">
                  {['today', 'week', 'month'].map((range) => (
                    <button
                      key={range}
                      onClick={() => handleDateRangeChange(range)}
                      className="px-2.5 py-1 text-[10px] font-bold uppercase bg-gray-50 dark:bg-slate-800 text-gray-500 hover:text-primary-500 rounded-md transition-all border border-gray-100 dark:border-slate-700"
                    >
                      {range === 'today' ? 'Hari Ini' : range === 'week' ? '7 Hari' : 'Bulan Ini'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-xl p-0.5 bg-gray-100/50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 overflow-hidden">
                <div className="relative group p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-transparent hover:border-primary-500/30 transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <FiCalendar className="text-primary-500 h-3 w-3" />
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Mulai</span>
                  </div>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className="w-full bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-gray-200"
                  />
                </div>
                <div className="relative group p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-transparent hover:border-primary-500/30 transition-all">
                  <div className="flex items-center gap-2 mb-1">
                    <FiCalendar className="text-primary-500 h-3 w-3" />
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Sampai</span>
                  </div>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    className="w-full bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-gray-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800/30 rounded-xl border border-gray-100 dark:border-slate-800">
                <span className="text-xs font-bold text-gray-500">Format Ekspor</span>
                <div className="flex gap-2">
                  {['pdf', 'excel'].map((format) => (
                    <button
                      key={format}
                      onClick={() => setFormatType(format)}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formatType === format
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
                        : 'bg-white dark:bg-slate-800 text-gray-400 border border-gray-200 dark:border-slate-700 hover:text-gray-600'
                        }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={generateBorrowingReport}
              disabled={isGenerating}
              className="btn-primary w-full h-12 flex items-center justify-center group"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Memproses...
                </>
              ) : (
                <>
                  <FiDownload className="mr-2 group-hover:translate-y-0.5 transition-transform" />
                  Unduh Laporan Peminjaman
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section Laporan Inventaris */}
        <div className="card h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 mr-4">
                  <FiPackage className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Daftar Inventaris</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Ekspor status stok barang saat ini</p>
                </div>
              </div>
            </div>

            {inventoryReport ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Total Barang</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white">{inventoryReport.summary.totalItems}</p>
                    <div className="absolute top-2 right-2 p-1.5 bg-white/50 dark:bg-slate-700/50 rounded-lg text-gray-400">
                      <FiPackage size={14} />
                    </div>
                  </div>
                  <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100 dev:from-emerald-900/20 dark:from-slate-800 dark:to-slate-800/50 p-4 rounded-xl border border-emerald-100/50 dark:border-slate-700">
                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none mb-1">Tersedia</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{inventoryReport.summary.availableItems}</p>
                    <div className="absolute top-2 right-2 p-1.5 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400">
                      <FiFileText size={14} />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Ringkasan Kategori</h4>
                  <div className="space-y-3">
                    {inventoryReport.categoryStats.slice(0, 5).map((stat, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{stat.categoryName}</span>
                        <span className="text-xs font-black text-primary-600">{stat.itemCount} <span className="text-[10px] text-gray-400 font-normal">item</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleExportInventoryExcel}
              className="btn-secondary flex-1 h-12 flex items-center justify-center font-bold text-xs group transition-all"
            >
              <FiDownload className="mr-2 group-hover:translate-y-0.5" /> EKSPOR EXCEL
            </button>
            <button
              onClick={handleExportInventoryPDF}
              className="btn-secondary flex-1 h-12 flex items-center justify-center font-bold text-xs group transition-all"
            >
              <FiDownload className="mr-2 group-hover:translate-y-0.5" /> EKSPOR PDF
            </button>
          </div>
        </div>
      </div>

      <div className="bg-primary-50 dark:bg-primary-900/10 p-6 rounded-3xl border border-primary-100/50 dark:border-primary-900/30 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-primary-600">
          <FiFileText size={24} />
        </div>
        <div>
          <h3 className="text-sm font-black text-primary-900 dark:text-primary-100 uppercase tracking-tight">Dokumentasi Laporan</h3>
          <p className="text-xs text-primary-700/70 dark:text-primary-400/70">Pastikan rentang tanggal sudah benar sebelum mengunduh. Laporan Excel berisi data mentah yang dapat difilter secara manual.</p>
        </div>
      </div>
    </div>
  );
};

export default Reports;