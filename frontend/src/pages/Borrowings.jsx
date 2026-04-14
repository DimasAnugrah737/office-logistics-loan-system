import React, { useState, useEffect } from 'react';
import { borrowingsAPI } from '../api/borrowings';
import { usersAPI } from '../api/users';
import { itemsAPI } from '../api/items';
import { useApi } from '../hooks/useApi';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { FiEye, FiCheck, FiX, FiCalendar, FiPackage, FiDownload, FiSearch, FiBarChart2, FiUsers, FiAlertCircle, FiFilter, FiArrowRight, FiInfo, FiHash, FiMapPin, FiTrash2 } from 'react-icons/fi';
import { FaClock, FaCheckCircle, FaTimesCircle, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { format } from 'date-fns';

const Borrowings = () => {
  const { user, isAdmin, isOfficer } = useAuth();
  const socket = useSocket();
  const location = useLocation();
  const [borrowings, setBorrowings] = useState([]);
  const [filteredBorrowings, setFilteredBorrowings] = useState([]);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [itemFilter, setItemFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingBorrowing, setViewingBorrowing] = useState(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isPenaltyModalOpen, setIsPenaltyModalOpen] = useState(false);
  const [pendingPenaltyBorrowing, setPendingPenaltyBorrowing] = useState(null);
  const [actionType, setActionType] = useState('');
  const [selectedBorrowing, setSelectedBorrowing] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('good');
  const [penaltyAmount, setPenaltyAmount] = useState('');

  const { execute: fetchBorrowings, loading } = useApi(borrowingsAPI.getAllBorrowings);
  const { execute: fetchUsers } = useApi(usersAPI.getAllUsers);
  const { execute: fetchItems } = useApi(itemsAPI.getAllItems);
  const { execute: approveBorrowing } = useApi(borrowingsAPI.approveBorrowing);
  const { execute: rejectBorrowing } = useApi(borrowingsAPI.rejectBorrowing);
  const { execute: markAsBorrowed } = useApi(borrowingsAPI.markAsBorrowed);
  const { execute: requestReturn } = useApi(borrowingsAPI.requestReturn);
  const { execute: approveReturn } = useApi(borrowingsAPI.approveReturn);

  useEffect(() => {
    // Tangani parameter pencarian dari URL (untuk navigasi notifikasi)
    const params = new URLSearchParams(location.search);
    const searchId = params.get('search');
    if (searchId) {
      setSearchTerm(searchId);
      loadData(searchId);
    } else {
      loadData();
    }
  }, [location.search]);

  useEffect(() => {
    filterBorrowings();
  }, [borrowings, searchTerm, statusFilter, userFilter, itemFilter, dateFilter, dateRange]);

  const loadData = async (searchId = null) => {
    try {
      const params = { limit: 100 }; // Tingkatkan limit untuk mendapatkan lebih banyak data untuk pemfilteran frontend
      if (searchId) params.search = searchId;

      const [bData, iData, uData] = await Promise.all([
        fetchBorrowings(params),
        fetchItems(),
        fetchUsers(),
      ]);

      // Tangani data terpaginasi untuk peminjaman
      let loadedBorrowings = [];
      if (bData && bData.borrowings) {
        loadedBorrowings = bData.borrowings;
      } else if (Array.isArray(bData)) {
        loadedBorrowings = bData;
      }
      setBorrowings(loadedBorrowings);
      
      // DEBUG LOG
      const checkBmw = loadedBorrowings.find(b => b.id === 34 || (b.item && b.item.name && b.item.name.includes('BMW')));
      if (checkBmw) console.log('DEBUG BMW M3:', JSON.stringify(checkBmw, null, 2));

      if (searchId) {
        const found = loadedBorrowings.find(b => String(b.id) === String(searchId));
        if (found) {
          setViewingBorrowing(found);
          setIsViewModalOpen(true);
        }
      } else if (viewingBorrowing) {
        // Jika modal detail terbuka, pastikan data sinkron dengan yang terbaru dari server
        const updated = loadedBorrowings.find(b => b.id === viewingBorrowing.id);
        if (updated) setViewingBorrowing(updated);
      }

      // Tangani data terpaginasi untuk barang
      if (iData && iData.items) {
        setItems(iData.items);
      } else if (Array.isArray(iData)) {
        setItems(iData);
      } else {
        setItems([]);
      }

      // Tangani data terpaginasi untuk pengguna
      let userList = [];
      if (uData && uData.users) {
        userList = uData.users;
      } else if (Array.isArray(uData)) {
        userList = uData;
      }

      const borrowersOnly = userList.filter(u => u.role === 'user');
      setUsers(borrowersOnly.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this borrowing record permanently? This action cannot be undone.')) return;
    try {
      await borrowingsAPI.deleteBorrowing(id);
      toast.success('Borrowing record deleted successfully');
      loadData();
    } catch (error) {
      console.error('Failed to delete data:', error);
      toast.error('Failed to delete data');
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handleBorrowingUpdate = () => loadData();
    socket.on('borrowing:created', handleBorrowingUpdate);
    socket.on('borrowing:approved', handleBorrowingUpdate);
    socket.on('borrowing:rejected', handleBorrowingUpdate);
    socket.on('borrowing:borrowed', handleBorrowingUpdate);
    socket.on('borrowing:returned', handleBorrowingUpdate);
    socket.on('borrowing:return_approved', handleBorrowingUpdate);
    socket.on('borrowing:cancelled', handleBorrowingUpdate);
    socket.on('borrowing:deleted', handleBorrowingUpdate);
    socket.on('borrowing:updated', handleBorrowingUpdate);
    socket.on('user:created', handleBorrowingUpdate);
    socket.on('user:updated', handleBorrowingUpdate);
    socket.on('user:deleted', handleBorrowingUpdate);

    // Tambahkan pendengar jendela untuk event refresh kustom
    window.addEventListener('refresh-borrowings', handleBorrowingUpdate);

    return () => {
      socket.off('borrowing:created', handleBorrowingUpdate);
      socket.off('borrowing:approved', handleBorrowingUpdate);
      socket.off('borrowing:rejected', handleBorrowingUpdate);
      socket.off('borrowing:borrowed', handleBorrowingUpdate);
      socket.off('borrowing:returned', handleBorrowingUpdate);
      socket.off('borrowing:return_approved', handleBorrowingUpdate);
      socket.off('borrowing:cancelled', handleBorrowingUpdate);
      socket.off('user:created', handleBorrowingUpdate);
      socket.off('user:updated', handleBorrowingUpdate);
      socket.off('user:deleted', handleBorrowingUpdate);
      socket.off('borrowing:deleted', handleBorrowingUpdate);
      window.removeEventListener('refresh-borrowings', handleBorrowingUpdate);
    };
  }, [socket]);

  const filterBorrowings = () => {
    let filtered = [...borrowings];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((borrowing) => {
        const userName = borrowing.user?.fullName?.toLowerCase() || '';
        const itemName = borrowing.item?.name?.toLowerCase() || '';
        const borrowingId = String(borrowing.id || '').toLowerCase();
        return userName.includes(term) || itemName.includes(term) || borrowingId.includes(term);
      });
    }
    if (statusFilter === 'penalty') {
      filtered = filtered.filter((borrowing) => borrowing.penalty > 0 && (borrowing.penaltyStatus || borrowing.penalty_status) !== 'paid');
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter((borrowing) => borrowing.status === statusFilter);
    }
    if (userFilter !== 'all') filtered = filtered.filter((borrowing) => typeof borrowing.user === 'object' ? borrowing.user.id === Number(userFilter) : borrowing.user === Number(userFilter));
    if (itemFilter !== 'all') filtered = filtered.filter((borrowing) => typeof borrowing.item === 'object' ? borrowing.item.id === Number(itemFilter) : borrowing.item === Number(itemFilter));
    if (dateFilter === 'today') {
      const today = format(new Date(), 'yyyy-MM-dd');
      filtered = filtered.filter((borrowing) => format(new Date(borrowing.borrowDate), 'yyyy-MM-dd') === today);
    } else if (dateFilter === 'this_week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      filtered = filtered.filter((borrowing) => new Date(borrowing.borrowDate) >= oneWeekAgo);
    } else if (dateFilter === 'custom' && dateRange.from && dateRange.to) {
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((borrowing) => {
        const borrowDate = new Date(borrowing.borrowDate);
        return borrowDate >= fromDate && borrowDate <= toDate;
      });
    }
    setFilteredBorrowings(filtered);
  };

  const handleView = (borrowing) => {
    setViewingBorrowing(borrowing);
    setIsViewModalOpen(true);
  };

  const handleAction = (borrowing, type) => {
    setSelectedBorrowing(borrowing);
    setActionType(type);
    setActionNotes('');
    setSelectedCondition('good');
    setPenaltyAmount('');
    setIsActionModalOpen(true);
  };

  const performAction = async () => {
    try {
      switch (actionType) {
        case 'approve': await approveBorrowing(selectedBorrowing.id, actionNotes); break;
        case 'reject': await rejectBorrowing(selectedBorrowing.id, actionNotes); break;
        case 'borrow': await markAsBorrowed(selectedBorrowing.id, 'good', actionNotes); break;
        case 'take': await markAsBorrowed(selectedBorrowing.id, 'good', actionNotes); break; // Alias for borrow
        case 'return': await requestReturn(selectedBorrowing.id, 'good', actionNotes); break;
        case 'approve_return':
          const finalPenalty = selectedCondition === 'broken' && penaltyAmount ? parseFloat(penaltyAmount) : undefined;
          await approveReturn(selectedBorrowing.id, selectedCondition, actionNotes, finalPenalty, 'unpaid');
          break;
      }
      setIsActionModalOpen(false);
      setSelectedBorrowing(null);
      setActionType('');
      setActionNotes('');
      setPenaltyAmount('');
      loadData();
      toast.success('Action successfully performed');
    } catch (error) {
      console.error('Failed to perform action:', error);
    }
  };

  const handleTogglePenaltyStatus = (borrowing) => {
    setPendingPenaltyBorrowing(borrowing);
    setIsPenaltyModalOpen(true);
  };

  const confirmTogglePenaltyStatus = async () => {
    const borrowing = pendingPenaltyBorrowing;
    try {
      const currentStatus = (borrowing.penaltyStatus || borrowing.penalty_status || '').toLowerCase() || 'none';
      const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
      const response = await borrowingsAPI.updatePenaltyStatus(borrowing.id, newStatus, undefined);
      
      toast.success(`Penalty marked as ${newStatus === 'paid' ? 'PAID' : 'UNPAID'}`);
      
      if (viewingBorrowing && viewingBorrowing.id === borrowing.id) {
        setViewingBorrowing({ 
          ...viewingBorrowing, 
          penaltyStatus: newStatus,
          penalty_status: newStatus 
        });
      }
      
      // Tetap panggil loadData untuk menyinkronkan daftar di belakang (tanpa jeda mencolok)
      loadData();
      setIsPenaltyModalOpen(false);
      setPendingPenaltyBorrowing(null);
    } catch (error) {
      console.error('Failed to update penalty status:', error);
      toast.error('Failed to update penalty status. Please check your internet connection.');
    }
  };

  const statusLabels = {
    pending: 'Pending',
    approved: 'Approved',
    borrowed: 'Borrowed',
    returned: 'Returned',
    returning: 'Returning',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    overdue: 'Overdue',
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300',
      approved: 'bg-theme-primary-light text-theme-primary',
      borrowed: 'bg-theme-primary-light text-theme-primary',
      returned: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300',
      returning: 'bg-theme-primary-light text-theme-primary',
      rejected: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300',
      cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500 italic',
      overdue: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    };
    return colors[status] || colors.pending;
  };
  
  const getStatusIcon = (status) => {
    const icons = {
      pending: <FaClock className="mr-1" />,
      approved: <FaCheckCircle className="mr-1" />,
      borrowed: <FaCheckCircle className="mr-1" />,
      returned: <FaCheckCircle className="mr-1" />,
      returning: <FaClock className="mr-1" />,
      rejected: <FaTimesCircle className="mr-1" />,
      cancelled: <FaTimesCircle className="mr-1" />,
      overdue: <FaClock className="mr-1" />,
    };
    return icons[status] || <FaClock className="mr-1" />;
  };

  const isOverdue = (borrowing) => {
    if (['returned', 'rejected', 'pending', 'cancelled', 'overdue'].includes(borrowing.status)) return false;
    const dueDate = new Date(borrowing.expectedReturnDate);
    // Overdue if current date has passed the end of the due day
    dueDate.setHours(23, 59, 59, 999);
    return new Date() > dueDate;
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Borrowings</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Manage equipment borrowing and return requests
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-none shadow-sm border border-gray-100 dark:border-slate-800 p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search User, Item, or Transaction ID..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 focus:border-theme-primary rounded-none outline-none text-sm font-medium transition-all"
            />
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="relative group">
              <FiBarChart2 className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-4 w-4 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-gray-400"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="borrowed">Borrowed</option>
                <option value="returned">Returned</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="overdue">Overdue</option>
                <option value="penalty">Penalty</option>
              </select>
            </div>

            <div className="relative group">
              <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-4 w-4 pointer-events-none" />
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-gray-400"
              >
                <option value="all">All Users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.fullName}</option>
                ))}
              </select>
            </div>

            <div className="relative group col-span-2 md:col-span-1">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-4 w-4 pointer-events-none" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-gray-400"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group overflow-hidden rounded-none border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30">
                <label className="text-[9px] font-black text-theme-primary uppercase tracking-widest absolute top-2 left-10 z-10">From Date</label>
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-4 w-4" />
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full pl-10 pr-4 pt-6 pb-2 bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-gray-200"
                />
              </div>
              <div className="relative group overflow-hidden rounded-none border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30">
                <label className="text-[9px] font-black text-theme-primary uppercase tracking-widest absolute top-2 left-10 z-10">To Date</label>
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-4 w-4" />
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-full pl-10 pr-4 pt-6 pb-2 bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-gray-200"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary"></div>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="table-header">Item</th>
                    <th className="table-header">User</th>
                    <th className="table-header">Qty</th>
                    <th className="table-header">Purpose</th>
                    <th className="table-header">Borrow Date</th>
                    <th className="table-header">Return Date</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredBorrowings.map((borrowing) => (
                    <tr key={borrowing.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center">
                          <FiPackage className="mr-2 text-theme-primary" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {typeof borrowing.item === 'object' ? borrowing.item.name : 'Loading...'}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="font-medium text-gray-900 dark:text-white flex items-center">
                          {typeof borrowing.user === 'object' ? borrowing.user.fullName : 'Loading...'}
                          {typeof borrowing.user === 'object' && borrowing.user.isBlockedFromBorrowing && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-none text-[8px] font-black bg-red-100 text-red-600 border border-red-200 uppercase tracking-tighter" title="This user is currently suspended from new borrowings">
                              <FiAlertCircle className="mr-0.5" /> Account Blocked
                            </span>
                          )}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {typeof borrowing.user === 'object' ? borrowing.user.nip : ''}
                        </div>
                      </td>
                      <td className="table-cell font-bold text-theme-primary">{borrowing.quantity}</td>
                      <td className="table-cell">
                        <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 max-w-[150px]" title={borrowing.purpose}>
                          {borrowing.purpose || '-'}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center text-xs">
                          <FiCalendar className="mr-1.5 text-theme-primary" />
                          {format(new Date(borrowing.borrowDate), 'dd MMM yyyy')}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center text-xs">
                          <FiCalendar className="mr-1.5 text-theme-primary" />
                          <span className={isOverdue(borrowing) ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                            {format(new Date(borrowing.expectedReturnDate), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-col space-y-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold uppercase ${getStatusColor(borrowing.status)}`}>
                            {getStatusIcon(borrowing.status)}
                            {statusLabels[borrowing.status] || borrowing.status}
                          </span>
                          {borrowing.status === 'overdue' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[9px] font-black uppercase bg-orange-100 text-orange-600 border border-orange-200">
                              <FiAlertCircle className="mr-1" size={10} /> Warning H+1
                            </span>
                          )}
                          {(() => {
                            const pStatus = (borrowing.penaltyStatus || borrowing.penalty_status || '').toLowerCase();
                            const isNotPaid = pStatus !== 'paid' && pStatus !== 'none';
                            return isNotPaid && Number(borrowing.penalty) > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[9px] font-black uppercase bg-red-600 text-white animate-pulse-subtle">
                                Unpaid Penalty
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleView(borrowing)}
                            className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none transition-colors"
                          >
                            <FiEye size={18} />
                          </button>
                          {user?.role === 'officer' && (
                            <>
                              {borrowing.status === 'pending' && (
                                <>
                                  <button onClick={() => handleAction(borrowing, 'approve')} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none transition-all"><FiCheck size={18} /></button>
                                  <button onClick={() => handleAction(borrowing, 'reject')} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none transition-all"><FiX size={18} /></button>
                                </>
                              )}
                              {borrowing.status === 'approved' && (
                                <button
                                  onClick={() => handleAction(borrowing, 'take')}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-none transition-all flex items-center"
                                  title="Mark as Handed Over"
                                >
                                  <FiPackage size={18} className="mr-1" />
                                  <span className="text-xs font-bold uppercase">Hand Over</span>
                                </button>
                              )}
                              {borrowing.status === 'returning' && (
                                <button
                                  onClick={() => handleAction(borrowing, 'approve_return')}
                                  className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none transition-all flex items-center"
                                  title="Approve Return"
                                >
                                  <FiCheck size={18} className="mr-1" />
                                  <span className="text-xs font-bold uppercase">Receive</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden grid grid-cols-2 gap-3 p-3">
              {filteredBorrowings.map((borrowing) => (
                <div key={borrowing.id} className="card !p-3 flex flex-col h-full hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded-none text-[8px] font-black uppercase tracking-tighter ${getStatusColor(borrowing.status)}`}>
                       {statusLabels[borrowing.status] || borrowing.status}
                    </span>
                    <span className="text-[8px] font-bold text-gray-400">#{borrowing.id}</span>
                  </div>

                  <div className="flex-grow">
                    <h4 className="text-[11px] font-black text-gray-900 dark:text-white leading-tight line-clamp-2 mb-1 uppercase tracking-tight">
                      {typeof borrowing.item === 'object' ? borrowing.item.name : 'Unknown Item'}
                    </h4>
                    <p className="text-[9px] text-gray-500 font-bold truncate">
                      {typeof borrowing.user === 'object' ? borrowing.user.fullName : 'Unknown User'}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-gray-400">
                      <span>Qty</span>
                      <span className="text-theme-primary">{borrowing.quantity}</span>
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-gray-400">
                      <span>Due</span>
                      <span className={isOverdue(borrowing) ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}>
                        {format(new Date(borrowing.expectedReturnDate), 'dd/MM')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-1.5">
                    <button 
                       onClick={() => handleView(borrowing)} 
                       className="flex-1 py-1.5 bg-gray-50 dark:bg-slate-800 text-theme-primary rounded-none flex items-center justify-center"
                    >
                      <FiEye size={14} />
                    </button>
                    {(user?.role === 'officer' || user?.role === 'admin') && borrowing.status === 'pending' && (
                       <button 
                          onClick={() => handleAction(borrowing, 'approve')} 
                          className="flex-1 py-1.5 bg-theme-primary-light text-theme-primary rounded-none flex items-center justify-center"
                       >
                         <FiCheck size={14} />
                       </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Action Modal */}
      {
        isActionModalOpen && selectedBorrowing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-none w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                  {actionType === 'take' ? 'Confirm Item Handover' : (statusLabels[actionType] || actionType) + ' Request'}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {actionType === 'take' ? 'Has the user physically taken the item?' : `Are you sure you want to perform this action?`}
                </p>

                 {(actionType === 'approve' || actionType === 'reject') && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-none border border-gray-100 dark:border-slate-600">
                    <p className="text-[10px] font-black text-theme-primary uppercase tracking-widest mb-1.5 text-center">Borrowing Purpose</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic text-center leading-relaxed font-medium">
                      "{selectedBorrowing.purpose || 'No purpose specified.'}"
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {actionType === 'approve_return' && (
                     <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Condition Result</label>
                        <select
                          value={selectedCondition}
                          onChange={(e) => setSelectedCondition(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-none outline-none text-sm font-bold"
                        >
                          <option value="good">Good (Normal)</option>
                          <option value="broken">Broken (Defective)</option>
                        </select>
                      </div>

                      {selectedCondition === 'broken' && (
                         <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5 flex justify-between">
                            <span>Penalty Amount (IDR)</span>
                            <span className="text-[9px] lowercase italic text-red-400 font-medium">Payment is made outside the application</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">Rp</span>
                            <input
                              type="number"
                              value={penaltyAmount}
                              onChange={(e) => setPenaltyAmount(e.target.value)}
                              placeholder="e.g. 50000"
                              className="w-full pl-12 pr-4 py-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-none outline-none text-sm font-black text-red-600 dark:text-red-400 placeholder:text-red-300"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                   <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Notes (Optional)</label>
                    <textarea
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-none outline-none text-sm min-h-[100px]"
                      placeholder="Add notes for this action..."
                    />
                  </div>
                </div>

                 <div className="mt-8 flex space-x-3">
                  <button
                    onClick={() => setIsActionModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold rounded-none text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={performAction}
                    className={`flex-1 py-3 text-white font-bold rounded-none text-xs uppercase tracking-widest shadow-lg transition-all ${actionType === 'reject' ? 'bg-red-600 shadow-red-500/20 hover:bg-red-700' : 'bg-theme-primary shadow-theme-primary/20 hover:bg-primary-700'}`}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {
        isViewModalOpen && viewingBorrowing && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-none w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Borrowing Details</h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                     <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Item</p>
                      <p className="font-bold text-gray-900 dark:text-white">{typeof viewingBorrowing.item === 'object' ? viewingBorrowing.item.name : 'Loading...'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Quantity</p>
                      <p className="font-bold text-theme-primary">{viewingBorrowing.quantity}</p>
                    </div>
                     <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">User</p>
                      <p className="font-bold text-gray-900 dark:text-white">{typeof viewingBorrowing.user === 'object' ? viewingBorrowing.user.fullName : 'Loading...'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">NIP/Employee ID</p>
                      <p className="font-bold text-gray-900 dark:text-white">{typeof viewingBorrowing.user === 'object' ? viewingBorrowing.user.nip : 'Loading...'}</p>
                    </div>
                  </div>

                   <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-none border border-gray-100 dark:border-slate-600">
                    <p className="text-[10px] font-bold text-theme-primary uppercase tracking-widest mb-1.5">Borrowing Purpose</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                      "{viewingBorrowing.purpose || 'No purpose specified.'}"
                    </p>
                  </div>

                   {viewingBorrowing.penalty > 0 && (
                    <div className="p-5 bg-red-50 dark:bg-red-900/10 rounded-none border border-red-100 dark:border-red-900/30">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Damage Penalty</p>
                          <p className="text-xl font-black text-red-600 dark:text-red-400">Rp {Number(viewingBorrowing.penalty).toLocaleString('id-ID')}</p>
                        </div>
                        <div className="text-right space-y-2">
                          <span className={`inline-flex px-3 py-1 rounded-none text-[10px] font-black uppercase tracking-wider ${((viewingBorrowing.penaltyStatus || viewingBorrowing.penalty_status || '').toLowerCase() === 'paid') ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse-subtle'}`}>
                            {(viewingBorrowing.penaltyStatus || viewingBorrowing.penalty_status || '').toLowerCase() === 'paid' ? 'PAID' : 'UNPAID'}
                          </span>
                           {(user?.role === 'officer' || user?.role === 'admin') && (
                            <button
                              onClick={() => handleTogglePenaltyStatus(viewingBorrowing)}
                              className={`flex items-center space-x-2 px-3 py-1.5 rounded-none text-xs font-bold transition-all ${(viewingBorrowing.penaltyStatus || viewingBorrowing.penalty_status || '').toLowerCase() === 'paid' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-500/20'}`}
                            >
                              {(viewingBorrowing.penaltyStatus || viewingBorrowing.penalty_status || '').toLowerCase() === 'paid' ? 'Mark as Unpaid' : 'Confirm Payment'}
                            </button>
                          )}
                        </div>
                      </div>
                       <div className="mt-2 text-right">
                         <span className="text-[8px] text-gray-400 uppercase font-bold tracking-tighter">Transaction ID: #{viewingBorrowing.id}</span>
                      </div>
                       {viewingBorrowing.notes && (
                        <div className="mt-4 pt-4 border-t border-red-100 dark:border-red-900/30">
                          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Officer Notes</p>
                          <p className="text-sm text-red-700 dark:text-red-300 italic">"{viewingBorrowing.notes}"</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                 <div className="mt-8 flex justify-end">
                  <button onClick={() => setIsViewModalOpen(false)} className="px-6 py-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold rounded-none hover:bg-gray-200 transition-all">Close</button>
                </div>
              </div>
            </div>
          </div>
        )
      }

       <ConfirmationModal
        isOpen={isPenaltyModalOpen}
        onClose={() => setIsPenaltyModalOpen(false)}
        onConfirm={confirmTogglePenaltyStatus}
        title="Change Penalty Status"
        message={`Are you sure you want to mark this penalty as ${pendingPenaltyBorrowing?.penaltyStatus === 'paid' ? 'UNPAID' : 'PAID'}?`}
        confirmText="Change Status"
        type={pendingPenaltyBorrowing?.penaltyStatus === 'paid' ? 'danger' : 'primary'}
        icon={FiAlertCircle}
      />
    </div>
  );
};

export default Borrowings;