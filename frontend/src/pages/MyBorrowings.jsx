import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { borrowingsAPI } from '../api/borrowings';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { WS_URL } from '../api/axiosConfig';
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
  FiGrid,
  FiList,
  FiSlash
} from 'react-icons/fi';
import { FaCheckCircle, FaTimesCircle, FaClock, FaBan, FaCalendarCheck } from 'react-icons/fa';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

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
  const [viewMode, setViewMode] = useState('grid'); // Grid/List toggle

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

    // Tambahkan pendengar jendela untuk event refresh kustom
    const refreshListener = () => loadBorrowings();
    window.addEventListener('refresh-borrowings', refreshListener);

    return () => {
      socket.off('borrowing:created', handleUpdate);
      socket.off('borrowing:approved', handleUpdate);
      socket.off('borrowing:rejected', handleUpdate);
      socket.off('borrowing:borrowed', handleUpdate);
      socket.off('borrowing:returned', handleUpdate);
      socket.off('borrowing:cancelled', handleUpdate);
      window.removeEventListener('refresh-borrowings', refreshListener);
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
        filtered = filtered.filter(b => (b.penaltyStatus || b.penalty_status || '').toLowerCase() === 'unpaid' && b.penalty > 0);
      } else {
        filtered = filtered.filter(b => b.status === statusFilter);
      }
    }
    setFilteredBorrowings(filtered);
  };

  const handleReturnSubmit = async () => {
    try {
      await requestReturn(selectedBorrowingForReturn.id, 'good', returnNotes);
      toast.success('Return request sent');
      setIsReturnModalOpen(false);
      loadBorrowings();
    } catch (e) { }
  };

  const handleConfirmCancel = async () => {
    try {
      await cancelBorrowing(borrowingToCancel.id);
      toast.success('Borrowing cancelled');
      setIsCancelModalOpen(false);
      loadBorrowings();
    } catch (e) { }
  };

  const getStatusInfo = (status) => {
    const map = {
      pending: { label: 'Awaiting Approval', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: <FaClock /> },
      approved: { label: 'Approved', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: <FaCheckCircle /> },
      borrowed: { label: 'In Use', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <FiPackage /> },
      returning: { label: 'Returning', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: <FiClock /> },
      returned: { label: 'Returned', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: <FaCalendarCheck /> },
      rejected: { label: 'Rejected', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: <FaTimesCircle /> },
      cancelled: { label: 'Cancelled', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400', icon: <FaBan /> },
      overdue: { label: 'Overdue', color: 'bg-red-600 text-white animate-pulse', icon: <FiAlertTriangle /> }
    };
    return map[status] || map.pending;
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="flex items-center gap-4">
          <Link 
            to="/dashboard"
            className="p-3 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-none shadow-sm border border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            <FiArrowRight className="rotate-180" size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Borrowing History</h1>
            <p className="text-sm text-gray-500 font-medium">Monitor and manage your equipment borrowing history.</p>
          </div>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-none shadow-sm border border-gray-100 dark:border-slate-700/50">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2.5 rounded-none transition-all ${viewMode === 'grid' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FiGrid size={18} />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2.5 rounded-none transition-all ${viewMode === 'list' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FiList size={18} />
          </button>
        </div>
      </div>
        <div className="bg-white dark:bg-[#1e293b] rounded-none shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center">
          <div className="md:col-span-12 lg:col-span-6 relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ID or item..."
              className="w-full pl-12 pr-4 py-3 sm:py-4 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 focus:border-theme-primary rounded-none outline-none text-xs sm:text-sm font-medium transition-all"
            />
          </div>
          <div className="md:col-span-12 lg:col-span-6 relative">
            <FiFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-12 pr-10 py-3 sm:py-4 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-[9px] sm:text-[10px] font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-gray-100 transition-all text-gray-600 dark:text-gray-400"
            >
              <option value="all">All Status</option>
              <option value="unpaid_penalty">Unpaid Penalty</option>
              {['pending', 'approved', 'borrowed', 'returning', 'returned', 'overdue'].map(s => (
                <option key={s} value={s}>{getStatusInfo(s).label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4 sm:gap-6`}>
          {[1, 2, 3].map(n => <div key={n} className="bg-gray-100 dark:bg-gray-800 h-64 rounded-none animate-pulse" />)}
        </div>
      ) : filteredBorrowings.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-gray-800 rounded-none border border-dashed border-gray-200 dark:border-gray-700">
          <FiBox size={60} className="mx-auto text-gray-300 mb-6" />
          <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">No History Yet</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto mt-2">You haven't made any borrowings or no data matches the filter.</p>
        </div>
      ) : (
        <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4 sm:gap-8 pb-10`}>
          {filteredBorrowings.map((b) => {
            const status = getStatusInfo(b.status);
            return viewMode === 'grid' ? (
              /* GRID VIEW */
              <div 
                key={b.id} 
                onClick={() => { setViewingBorrowing(b); setIsViewModalOpen(true); }}
                className="group bg-white dark:bg-gray-800 rounded-none p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col cursor-pointer"
              >
                <div className="relative h-32 sm:h-48 overflow-hidden rounded-none mb-3 sm:mb-4 bg-gray-50 dark:bg-gray-900">
                  {b.item?.image ? (
                    <img
                      className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                      src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${b.item.image}`}
                      alt=""
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300"><FiPackage size={48} /></div>
                  )}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-0.5 rounded-none text-[8px] font-black uppercase tracking-widest shadow-lg ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                    <span className="text-[10px] font-black text-white bg-black/60 backdrop-blur-md px-3 py-1 border border-white/20">#{b.id}</span>
                    {(b.status === 'approved' || b.status === 'borrowed') && (
                      <span className="text-[8px] font-black bg-theme-primary text-white px-2 py-0.5 animate-pulse">PICKUP CODE</span>
                    )}
                  </div>
                </div>

                <div className="flex-grow flex flex-col pt-2">
                  <h3 className="text-sm sm:text-lg font-black text-gray-900 dark:text-white tracking-tight mb-2 line-clamp-1 truncate group-hover:text-primary-600 transition-colors uppercase">
                    {b.item?.name || 'Item deleted'}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4">
                    <div>
                      <p className="text-[7px] sm:text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Borrow Date</p>
                      <p className="text-[9px] sm:text-[10px] font-bold text-gray-700 dark:text-gray-300">
                        {format(new Date(b.borrowDate), 'dd MMM yy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[7px] sm:text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">Quantity</p>
                      <p className="text-[9px] sm:text-[10px] font-black text-primary-600 uppercase">{b.quantity} Unit</p>
                    </div>
                  </div>

                  <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                    <button
                      onClick={() => { setViewingBorrowing(b); setIsViewModalOpen(true); }}
                      className="flex-grow py-3 bg-gray-900 hover:bg-black text-white rounded-none font-black uppercase tracking-widest text-[9px] sm:text-[10px] transition-all flex items-center justify-center gap-2"
                    >
                      <FiEye size={14} /> <span>Detail</span>
                    </button>
                    {(() => {
                      const isReturnable = b.status === 'borrowed' || b.status === 'overdue';
                      const isCancellable = b.status === 'pending' || b.status === 'approved';

                      if (isReturnable) {
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedBorrowingForReturn(b); setIsReturnModalOpen(true); }}
                            className="flex-grow py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none font-black uppercase tracking-widest text-[9px] sm:text-[10px] transition-all shadow-md shadow-emerald-500/20"
                          >
                            Return
                          </button>
                        );
                      }

                      if (isCancellable) {
                        return (
                          <button
                            onClick={(e) => { e.stopPropagation(); setBorrowingToCancel(b); setIsCancelModalOpen(true); }}
                            className="flex-grow py-3 border border-rose-200 text-rose-600 rounded-none font-black uppercase tracking-widest text-[9px] sm:text-[10px] hover:bg-rose-50 transition-all font-bold"
                          >
                            Cancel
                          </button>
                        );
                      }

                      return null;
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              /* LIST VIEW */
              <div 
                key={b.id} 
                onClick={() => { setViewingBorrowing(b); setIsViewModalOpen(true); }}
                className="group bg-white dark:bg-gray-800 rounded-none p-3 sm:pr-6 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-xl transition-all duration-300 flex items-center gap-4 sm:gap-6 cursor-pointer"
              >
                <div className="h-16 w-20 sm:h-24 sm:w-40 flex-shrink-0 relative overflow-hidden rounded-none bg-gray-50 dark:bg-gray-900 border border-gray-50 dark:border-gray-800">
                  {b.item?.image ? (
                    <img
                      className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                      src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${b.item.image}`}
                      alt=""
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-200"><FiPackage size={24} /></div>
                  )}
                  <div className="absolute top-1 left-1">
                    <span className={`px-2 py-0.5 rounded-none text-[6px] sm:text-[8px] font-black uppercase tracking-widest shadow-lg ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </div>

                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">ID: #{b.id}</span>
                  </div>
                  <h3 className="text-xs sm:text-xl font-black text-gray-900 dark:text-white tracking-tight truncate group-hover:text-primary-600 transition-colors uppercase leading-none mb-1 sm:mb-2">
                    {b.item?.name || 'Item deleted'}
                  </h3>
                  <div className="flex items-center gap-4">
                    <p className="text-[8px] sm:text-[10px] font-bold text-gray-500">
                      Borrowed: {format(new Date(b.borrowDate), 'dd MMM yy')}
                    </p>
                    <p className="text-[8px] sm:text-[10px] font-black text-primary-600 uppercase tracking-widest">
                       {b.quantity} Unit
                    </p>
                  </div>
                </div>

                <div className="flex gap-1.5 sm:gap-2 items-center flex-shrink-0">
                  <button
                    onClick={() => { setViewingBorrowing(b); setIsViewModalOpen(true); }}
                    className="p-2 sm:p-3 bg-gray-900 text-white rounded-none hover:bg-black transition-all"
                    title="View Details"
                  >
                    <FiEye size={16} />
                  </button>
                  {(() => {
                    const isReturnable = b.status === 'borrowed' || b.status === 'overdue';
                    const isCancellable = b.status === 'pending' || b.status === 'approved';
                    
                    if (isReturnable) {
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedBorrowingForReturn(b); setIsReturnModalOpen(true); }}
                          className="px-2 sm:px-4 py-2 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all"
                        >
                          Return
                        </button>
                      );
                    }
                    
                    if (isCancellable) {
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setBorrowingToCancel(b); setIsCancelModalOpen(true); }}
                          className="px-2 sm:px-4 py-2 sm:py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-none font-black uppercase tracking-widest text-[8px] sm:text-[9px] transition-all"
                        >
                          Cancel
                        </button>
                      );
                    }
                    
                    return null;
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}



      {/* Details Modal */}
      {isViewModalOpen && viewingBorrowing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 sm:p-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-none text-gray-900 dark:text-gray-100 z-10 transition-colors shadow-sm"><FiX size={18}/></button>
              <div className="p-6 sm:p-12 pt-14 sm:pt-12">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8">
                  <span className={`px-4 py-1.5 rounded-none text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${getStatusInfo(viewingBorrowing.status).color}`}>
                    {getStatusInfo(viewingBorrowing.status).label}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">Order ID: #{viewingBorrowing.id}</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-10">
                  <div className="w-full sm:w-32 h-40 sm:h-32 rounded-none bg-gray-50 dark:bg-gray-800 flex-shrink-0 border border-gray-100 dark:border-gray-700 overflow-hidden">
                    {viewingBorrowing.item?.image ? (
                      <img src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${viewingBorrowing.item.image}`} className="w-full h-full object-cover" alt=""/>
                    ) : <FiPackage className="w-full h-full p-8 text-gray-300"/>}
                  </div>
                  <div className="flex-grow pt-2">
                    <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tighter mb-2 uppercase">{viewingBorrowing.item?.name}</h2>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 leading-relaxed italic line-clamp-2">{viewingBorrowing.item?.description || 'No additional description.'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-10">
                  <div className="flex items-center gap-4 group">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-none flex items-center justify-center text-primary-600 border border-transparent group-hover:border-primary-500/20 transition-all flex-shrink-0"><FiCalendar size={20}/></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Borrowing Range</p>
                      <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                        {format(new Date(viewingBorrowing.borrowDate), 'dd MMM')} - {format(new Date(viewingBorrowing.expectedReturnDate), 'dd MMM yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 group">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-none flex items-center justify-center text-primary-600 border border-transparent group-hover:border-primary-500/20 transition-all flex-shrink-0"><FiInfo size={20}/></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Quantity</p>
                      <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white tracking-tight">{viewingBorrowing.quantity} Items</p>
                    </div>
                  </div>
                </div>

                {(viewingBorrowing.status === 'approved' || viewingBorrowing.status === 'borrowed') && (
                  <div className="mb-10 p-6 sm:p-8 bg-emerald-50 dark:bg-emerald-900/10 border-2 border-dashed border-emerald-200 dark:border-emerald-800 flex flex-col items-center text-center">
                    <p className="text-[9px] sm:text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-3 sm:mb-4">Digital Pickup Receipt</p>
                    <div className="text-4xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-widest mb-2">
                       #{viewingBorrowing.id}
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-bold text-emerald-700/50 dark:text-emerald-400/50 uppercase leading-tight">Show this ID to the officer for verification</p>
                  </div>
                )}

                <div className="space-y-4 pt-8 border-t border-gray-100 dark:border-gray-800">
                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Purpose of Use</h4>
                  <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-none border border-gray-100 dark:border-gray-700 text-sm italic font-medium text-gray-600 dark:text-gray-400">
                    "{viewingBorrowing.purpose || 'No description.'}"
                  </div>
                </div>

                {viewingBorrowing.notes && (
                  <div className="space-y-4 pt-8 border-t border-gray-100 dark:border-gray-800">
                    <h4 className="text-xs font-black text-primary-600 uppercase tracking-widest">Officer Notes</h4>
                    <div className="p-6 bg-primary-50/30 dark:bg-primary-900/10 rounded-none border border-primary-100/50 dark:border-primary-800/20 text-sm italic font-medium text-gray-700 dark:text-gray-300">
                      "{viewingBorrowing.notes}"
                    </div>
                  </div>
                )}

                {viewingBorrowing.penalty > 0 && (
                  <div className="mt-8 p-6 bg-rose-50 dark:bg-rose-900/10 rounded-none border border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Penalty Information</p>
                      <p className="text-xl font-black text-rose-600 dark:text-rose-400">Rp {Number(viewingBorrowing.penalty).toLocaleString('id-ID')}</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-none text-[10px] font-black uppercase tracking-widest ${(viewingBorrowing.penaltyStatus || viewingBorrowing.penalty_status || '').toLowerCase() === 'paid' ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'}`}>
                      {(viewingBorrowing.penaltyStatus || viewingBorrowing.penalty_status || '').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                )}

                <button onClick={() => setIsViewModalOpen(false)} className="w-full mt-10 py-5 bg-gray-900 dark:bg-gray-800 text-white rounded-none font-black uppercase tracking-widest text-xs hover:bg-black transition-all">Close History</button>
              </div>
           </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={handleConfirmCancel}
        title="Cancel Borrowing?"
        message="Are you sure you want to cancel this request? This process cannot be undone once approved."
        confirmText="Yes, Cancel"
        type="danger"
        icon={FiSlash}
      />

      {/* Return Notes Modal */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/90 backdrop-blur-md animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-gray-900 rounded-none p-8 w-full max-w-sm border border-white/10">
            <div className="text-center mb-8">
               <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-none flex items-center justify-center mx-auto mb-4">
                 <FiPackage size={32}/>
               </div>
               <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Return Item</h3>
               <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Complete Borrowing Session</p>
            </div>
            <textarea
              className="w-full p-6 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none outline-none text-sm font-medium italic focus:border-theme-primary transition-all min-h-[120px] mb-8"
              placeholder="Add item condition notes..."
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => setIsReturnModalOpen(false)} className="py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-widest text-xs rounded-none">Cancel</button>
               <button onClick={handleReturnSubmit} className="py-4 bg-emerald-600 text-white font-black uppercase tracking-widest text-xs rounded-none shadow-lg shadow-emerald-500/20">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBorrowings;