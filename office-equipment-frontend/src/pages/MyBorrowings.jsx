import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { borrowingsAPI } from '../api/borrowings';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import {
  FiEye,
  FiCalendar,
  FiPackage,
  FiClock,
  FiSearch,
  FiFilter,
  FiX,
  FiAlertTriangle,
  FiBox,
  FiArrowRight,
  FiInfo,
  FiHash,
  FiMapPin,
  FiSlash
} from 'react-icons/fi';
import { FaCheckCircle, FaTimesCircle, FaClock, FaBan, FaCalendarCheck } from 'react-icons/fa';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';

const MyBorrowings = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const [borrowings, setBorrowings] = useState([]);
  const [filteredBorrowings, setFilteredBorrowings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingBorrowing, setViewingBorrowing] = useState(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [selectedBorrowingForReturn, setSelectedBorrowingForReturn] = useState(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [borrowingToCancel, setBorrowingToCancel] = useState(null);

  const { execute: fetchMyBorrowings, loading } = useApi(borrowingsAPI.getUserBorrowingHistory);
  const { execute: requestReturn } = useApi(borrowingsAPI.requestReturn);
  const { execute: cancelBorrowing } = useApi(borrowingsAPI.cancelBorrowing);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchId = params.get('search');
    if (searchId) {
      setSearchTerm(searchId);
      loadBorrowings(searchId);
    } else {
      loadBorrowings();
    }
  }, [location.search]);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => loadBorrowings();
    socket.on('borrowing:created', handleUpdate);
    socket.on('borrowing:approved', handleUpdate);
    socket.on('borrowing:rejected', handleUpdate);
    socket.on('borrowing:borrowed', handleUpdate);
    socket.on('borrowing:returned', handleUpdate);
    socket.on('borrowing:cancelled', handleUpdate);
    return () => {
      socket.off('borrowing:created', handleUpdate);
      socket.off('borrowing:approved', handleUpdate);
      socket.off('borrowing:rejected', handleUpdate);
      socket.off('borrowing:borrowed', handleUpdate);
      socket.off('borrowing:returned', handleUpdate);
      socket.off('borrowing:cancelled', handleUpdate);
    };
  }, [socket]);

  useEffect(() => {
    filterBorrowings();
  }, [borrowings, searchTerm, statusFilter]);

  const loadBorrowings = async (searchId = null) => {
    try {
      const data = await fetchMyBorrowings();
      const loaded = Array.isArray(data) ? data : (data?.borrowings || []);
      setBorrowings(loaded);
      if (searchId && loaded.length > 0) {
        const found = loaded.find(b => String(b.id) === String(searchId));
        if (found) {
          setViewingBorrowing(found);
          setIsViewModalOpen(true);
        }
      }
    } catch (e) { }
  };

  const filterBorrowings = () => {
    let filtered = [...borrowings];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(b => (b.item?.name || '').toLowerCase().includes(term) || String(b.id).includes(term));
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'unpaid_penalty') {
        filtered = filtered.filter(b => b.penaltyStatus === 'unpaid' && b.penalty > 0);
      } else {
        filtered = filtered.filter(b => b.status === statusFilter);
      }
    }
    setFilteredBorrowings(filtered);
  };

  const handleReturnSubmit = async () => {
    try {
      await requestReturn(selectedBorrowingForReturn.id, 'good', returnNotes);
      toast.success('Pengembalian diajukan');
      setIsReturnModalOpen(false);
      loadBorrowings();
    } catch (e) { }
  };

  const handleConfirmCancel = async () => {
    try {
      await cancelBorrowing(borrowingToCancel.id);
      toast.success('Peminjaman dibatalkan');
      setIsCancelModalOpen(false);
      loadBorrowings();
    } catch (e) { }
  };

  const getStatusInfo = (status) => {
    const map = {
      pending: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <FaClock /> },
      approved: { label: 'Disetujui', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: <FaCheckCircle /> },
      borrowed: { label: 'Sedang Dipinjam', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <FiPackage /> },
      returning: { label: 'Proses Kembali', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: <FiClock /> },
      returned: { label: 'Sudah Kembali', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: <FaCalendarCheck /> },
      rejected: { label: 'Ditolak', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: <FaTimesCircle /> },
      cancelled: { label: 'Dibatalkan', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400', icon: <FaBan /> },
      overdue: { label: 'Terlambat', color: 'bg-red-600 text-white animate-pulse', icon: <FiAlertTriangle /> }
    };
    return map[status] || map.pending;
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter text-left">Riwayat Peminjaman</h1>
          <p className="text-xs text-gray-400 font-black uppercase tracking-widest mt-1 flex items-center gap-2">
            <Link to="/dashboard" className="text-primary-600 hover:underline">Beranda</Link>
            <span className="text-gray-300">/</span>
            Lacak dan kelola peralatan Anda
          </p>
        </div>
        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-grow md:w-64">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500" />
            <input
              type="text"
              placeholder="Cari ID atau barang..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none text-sm font-bold shadow-sm"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-4 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none text-xs font-black uppercase tracking-widest appearance-none shadow-sm cursor-pointer"
            >
              <option value="all">Semua</option>
              <option value="unpaid_penalty">Denda</option>
              {['pending', 'approved', 'borrowed', 'returning', 'returned', 'overdue'].map(s => (
                <option key={s} value={s}>{getStatusInfo(s).label}</option>
              ))}
            </select>
            <FiFilter className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredBorrowings.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 dark:bg-gray-800/30 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
          <FiBox size={60} className="mx-auto text-gray-300 mb-6" />
          <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Belum Ada Riwayat</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">Anda belum melakukan peminjaman atau tidak ada data yang sesuai filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredBorrowings.map((b) => {
            const status = getStatusInfo(b.status);
            return (
              <div
                key={b.id}
                className="group bg-white dark:bg-gray-800 rounded-3xl lg:rounded-[2.5rem] p-4 sm:p-6 lg:p-8 border border-gray-100 dark:border-gray-700 hover:shadow-2xl hover:shadow-gray-200/50 dark:hover:shadow-black/20 transition-all duration-500"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 sm:gap-6 lg:gap-8">
                  
                  {/* Top Mobile Row (Image + Name) */}
                  <div className="flex flex-row items-center gap-4 lg:hidden">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 bg-gray-50 dark:bg-gray-900 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-700">
                      {b.item?.image ? (
                        <img src={`${import.meta.env.VITE_WS_URL || 'http://localhost:5000'}${b.item.image}`} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300"><FiPackage size={24} /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[7px] sm:text-[9px] font-black uppercase tracking-widest ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="text-[7px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest">#{b.id}</span>
                      </div>
                      <h3 className="text-sm sm:text-xl font-black text-gray-900 dark:text-white tracking-tighter truncate">{b.item?.name || 'Barang dihapus'}</h3>
                    </div>
                  </div>

                  {/* Desktop Image */}
                  <div className="hidden lg:block w-32 h-32 bg-gray-50 dark:bg-gray-900 rounded-3xl overflow-hidden flex-shrink-0 border border-gray-100 dark:border-gray-700">
                    {b.item?.image ? (
                      <img src={`${import.meta.env.VITE_WS_URL || 'http://localhost:5000'}${b.item.image}`} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><FiPackage size={40} /></div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-grow space-y-3 sm:space-y-4">
                    <div className="hidden lg:flex flex-wrap items-center gap-3">
                      <span className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                      {b.penaltyStatus === 'unpaid' && (
                        <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-600 text-white shadow-lg shadow-rose-500/30">Denda Tertunggak</span>
                      )}
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID: #{b.id}</span>
                    </div>

                    <h3 className="hidden lg:block text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{b.item?.name || 'Barang dihapus'}</h3>

                    {b.penaltyStatus === 'unpaid' && (
                      <div className="lg:hidden bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-widest flex items-center justify-center">
                        ⚠️ Denda: Rp {Number(b.penalty).toLocaleString('id-ID')}
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 pt-2 lg:pt-0 border-t border-gray-50 dark:border-gray-700/50 lg:border-none">
                      <div>
                        <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Jumlah</p>
                        <p className="text-xs sm:text-lg flex items-center sm:block font-black text-primary-600">{b.quantity} U</p>
                      </div>
                      <div>
                        <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tgl Pinjam</p>
                        <p className="text-[10px] sm:text-sm font-bold text-gray-700 dark:text-gray-300">{format(new Date(b.borrowDate), 'dd MMM yy', { locale: id })}</p>
                      </div>
                      <div>
                        <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Est. Kembali</p>
                        <p className={`text-[10px] sm:text-sm font-bold ${b.status === 'borrowed' && new Date(b.expectedReturnDate) < new Date() ? 'text-rose-600' : 'text-gray-700 dark:text-gray-300'}`}>
                          {format(new Date(b.expectedReturnDate), 'dd MMM yy', { locale: id })}
                        </p>
                      </div>
                      {b.actualReturnDate && (
                        <div>
                          <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tgl Kembali</p>
                          <p className="text-[10px] sm:text-sm font-bold text-emerald-600">{format(new Date(b.actualReturnDate), 'dd MMM yy', { locale: id })}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row lg:flex-col w-full lg:w-48 gap-2 sm:gap-3 lg:gap-3 shrink-0 pt-2 lg:pt-0 overflow-x-auto scrollbar-hide pb-1">
                    <button
                      onClick={() => { setViewingBorrowing(b); setIsViewModalOpen(true); }}
                      className="flex-1 lg:flex-none min-w-[70px] py-3 lg:py-3 px-3 lg:px-6 bg-gray-900 border border-gray-900 hover:bg-black hover:border-black text-white rounded-xl lg:rounded-2xl font-black uppercase tracking-widest text-[8px] lg:text-[10px] transition-all flex items-center justify-center gap-1.5"
                    >
                      <FiEye /> <span className="hidden lg:inline">Detail</span>
                    </button>
                    {(b.status === 'borrowed' || b.status === 'overdue') && (
                      <button
                        onClick={() => { setSelectedBorrowingForReturn(b); setIsReturnModalOpen(true); }}
                        className="flex-1 lg:flex-none min-w-[80px] py-3 lg:py-3 px-3 lg:px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl lg:rounded-2xl font-black uppercase tracking-widest text-[8px] lg:text-[10px] transition-all shadow-md lg:shadow-lg shadow-emerald-500/20"
                      >
                        Kembalikan
                      </button>
                    )}
                    {(b.status === 'pending' || b.status === 'approved') && (
                      <button
                        onClick={() => { setBorrowingToCancel(b); setIsCancelModalOpen(true); }}
                        className="flex-1 lg:flex-none min-w-[80px] py-3 lg:py-3 px-3 lg:px-6 bg-white dark:bg-gray-700 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 rounded-xl lg:rounded-2xl font-black uppercase tracking-widest text-[8px] lg:text-[10px] hover:bg-rose-50 dark:hover:bg-rose-950 transition-all font-bold"
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats Summary for User */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card !p-6 flex flex-col items-center justify-center text-center">
            <FiPackage className="text-primary-600 mb-2" size={24} />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none mt-1">{borrowings.length}</p>
        </div>
        <div className="card !p-6 flex flex-col items-center justify-center text-center">
            <FiClock className="text-emerald-600 mb-2" size={24} />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aktif</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none mt-1">{borrowings.filter(b => b.status === 'borrowed' || b.status === 'overdue').length}</p>
        </div>
        <div className="card !p-6 flex flex-col items-center justify-center text-center ring-2 ring-primary-500/10">
            <FaClock className="text-amber-500 mb-2" size={24} />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menunggu</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white leading-none mt-1">{borrowings.filter(b => b.status === 'pending').length}</p>
        </div>
        <div className="card !p-6 flex flex-col items-center justify-center text-center ring-2 ring-rose-500/10">
            <FiAlertTriangle className="text-rose-600 mb-2" size={24} />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Denda</p>
            <p className="text-2xl font-black text-rose-600 leading-none mt-1">Rp {(user.totalUnpaidPenalties || 0).toLocaleString('id-ID')}</p>
        </div>
      </div>

      {/* Details Modal */}
      {isViewModalOpen && viewingBorrowing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-gray-900 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl relative">
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-6 right-6 p-3 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 z-10"><FiX size={20}/></button>
              <div className="p-8 sm:p-12">
                <div className="flex flex-wrap items-center gap-4 mb-8">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusInfo(viewingBorrowing.status).color}`}>
                    {getStatusInfo(viewingBorrowing.status).label}
                  </span>
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Booking ID: #{viewingBorrowing.id}</span>
                </div>

                <div className="flex gap-8 mb-10">
                  <div className="w-24 h-24 rounded-3xl bg-gray-50 dark:bg-gray-800 flex-shrink-0 border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {viewingBorrowing.item?.image ? (
                      <img src={`${import.meta.env.VITE_WS_URL || 'http://localhost:5000'}${viewingBorrowing.item.image}`} className="w-full h-full object-cover" alt=""/>
                    ) : <FiPackage className="w-full h-full p-6 text-gray-300"/>}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2">{viewingBorrowing.item?.name}</h2>
                    <p className="text-sm font-medium text-gray-500 leading-relaxed italic line-clamp-2">{viewingBorrowing.item?.description || 'Tidak ada deskripsi tambahan.'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-primary-600"><FiCalendar size={24}/></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rentang Peminjaman</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {format(new Date(viewingBorrowing.borrowDate), 'dd MMM')} - {format(new Date(viewingBorrowing.expectedReturnDate), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center text-primary-600"><FiInfo size={24}/></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Jumlah Unit</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{viewingBorrowing.quantity} Barang</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-8 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Tujuan Penggunaan</h4>
                  <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-700 text-sm italic font-medium text-gray-600 dark:text-gray-400">
                    "{viewingBorrowing.purpose || 'Tanpa keterangan.'}"
                  </div>
                </div>

                {viewingBorrowing.penalty > 0 && (
                  <div className="mt-8 p-6 bg-rose-50 dark:bg-rose-900/10 rounded-[2rem] border border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Informasi Denda</p>
                      <p className="text-xl font-black text-rose-600 dark:text-rose-400">Rp {Number(viewingBorrowing.penalty).toLocaleString('id-ID')}</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${viewingBorrowing.penaltyStatus === 'paid' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>
                      {viewingBorrowing.penaltyStatus === 'paid' ? 'Lunas' : 'Belum Lunas'}
                    </span>
                  </div>
                )}

                <button onClick={() => setIsViewModalOpen(false)} className="w-full mt-10 py-5 bg-gray-900 dark:bg-gray-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all">Tutup Riwayat</button>
              </div>
           </div>
        </div>
      )}

      {/* Cancel Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-md animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-md text-center border border-white/10">
            <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 transform -rotate-12">
              <FiSlash size={40}/>
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter mb-3">Batalkan Peminjaman?</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8 px-4">Apakah Anda yakin ingin membatalkan pengajuan ini? Proses ini tidak dapat dikembalikan lagi setelah disetujui.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setIsCancelModalOpen(false)} className="py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-widest text-[10px] rounded-2xl">Kembali</button>
              <button onClick={handleConfirmCancel} className="py-4 bg-rose-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-xl shadow-rose-500/20">Ya, Batalkan</button>
            </div>
          </div>
        </div>
      )}

      {/* Return Notes Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-md animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-sm border border-white/10">
            <div className="text-center mb-8">
               <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                 <FiPackage size={32}/>
               </div>
               <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Kembalikan Barang</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Selesaikan Sesi Peminjaman</p>
            </div>
            <textarea
              className="w-full p-6 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-3xl outline-none text-sm font-medium italic focus:border-primary-500 transition-all min-h-[120px] mb-8"
              placeholder="Tambahkan catatan kondisi barang..."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => setIsReturnModalOpen(false)} className="py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-widest text-xs rounded-2xl">Batal</button>
               <button onClick={handleReturnSubmit} className="py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-emerald-500/20">Kirim</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBorrowings;