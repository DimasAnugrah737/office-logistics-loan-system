import React, { useState, useEffect } from 'react';
import { borrowingsAPI } from '../api/borrowings';
import { usersAPI } from '../api/users';
import { itemsAPI } from '../api/items';
import { useApi } from '../hooks/useApi';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { FiEye, FiCheck, FiX, FiCalendar, FiPackage, FiDownload, FiSearch, FiBarChart2, FiUsers, FiAlertCircle } from 'react-icons/fi';
import { FaClock, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';
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
    // Handle search parameter from URL (for notification navigation)
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
      const params = { limit: 100 }; // Increase limit to get more data for frontend filtering
      if (searchId) params.search = searchId;

      const [bData, iData, uData] = await Promise.all([
        fetchBorrowings(params),
        fetchItems(),
        fetchUsers(),
      ]);

      // Handle paginated for borrowings
      let loadedBorrowings = [];
      if (bData && bData.borrowings) {
        loadedBorrowings = bData.borrowings;
      } else if (Array.isArray(bData)) {
        loadedBorrowings = bData;
      }
      setBorrowings(loadedBorrowings);

      if (searchId) {
        const found = loadedBorrowings.find(b => String(b.id) === String(searchId));
        if (found) {
          setViewingBorrowing(found);
          setIsViewModalOpen(true);
        }
      }

      // Handle paginated for items
      if (iData && iData.items) {
        setItems(iData.items);
      } else if (Array.isArray(iData)) {
        setItems(iData);
      } else {
        setItems([]);
      }

      // Handle paginated for users
      let userList = [];
      if (uData && uData.users) {
        userList = uData.users;
      } else if (Array.isArray(uData)) {
        userList = uData;
      }

      const borrowersOnly = userList.filter(u => u.role === 'user');
      setUsers(borrowersOnly.sort((a, b) => a.fullName.localeCompare(b.fullName)));
    } catch (error) {
      console.error('Failed to load data:', error);
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
    socket.on('user:created', handleBorrowingUpdate);
    socket.on('user:updated', handleBorrowingUpdate);
    socket.on('user:deleted', handleBorrowingUpdate);
    return () => {
      socket.off('borrowing:created', handleBorrowingUpdate);
      socket.off('borrowing:approved', handleBorrowingUpdate);
      socket.off('borrowing:rejected', handleBorrowingUpdate);
      socket.off('borrowing:borrowed', handleBorrowingUpdate);
      socket.off('borrowing:returned', handleBorrowingUpdate);
      socket.off('borrowing:return_approved', handleBorrowingUpdate);
      socket.off('user:created', handleBorrowingUpdate);
      socket.off('user:updated', handleBorrowingUpdate);
      socket.off('user:deleted', handleBorrowingUpdate);
    };
  }, [socket]);

  const filterBorrowings = () => {
    let filtered = [...borrowings];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((borrowing) => {
        const userName = typeof borrowing.user === 'object' ? borrowing.user.fullName.toLowerCase() : '';
        const itemName = typeof borrowing.item === 'object' ? borrowing.item.name.toLowerCase() : '';
        const borrowingId = String(borrowing.id).toLowerCase();
        return userName.includes(term) || itemName.includes(term) || borrowingId.includes(term);
      });
    }
    if (statusFilter !== 'all') filtered = filtered.filter((borrowing) => borrowing.status === statusFilter);
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
      toast.success('Aksi berhasil dilakukan');
    } catch (error) {
      console.error('Failed to perform action:', error);
    }
  };

  const handleTogglePenaltyStatus = async (borrowing) => {
    try {
      const newStatus = borrowing.penaltyStatus === 'paid' ? 'unpaid' : 'paid';
      await borrowingsAPI.updatePenaltyStatus(borrowing.id, newStatus, undefined);
      toast.success(`Denda ditandai sebagai ${newStatus === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}`);
      if (viewingBorrowing && viewingBorrowing.id === borrowing.id) {
        setViewingBorrowing({ ...viewingBorrowing, penaltyStatus: newStatus });
      }
      loadData();
    } catch (error) {
      console.error('Failed to update penalty status:', error);
    }
  };

  const statusLabels = {
    pending: 'Menunggu',
    approved: 'Disetujui',
    borrowed: 'Dipinjam',
    returned: 'Dikembalikan',
    returning: 'Proses Kembali',
    rejected: 'Ditolak',
    cancelled: 'Dibatalkan',
    overdue: 'Terlambat',
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300',
      approved: 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400',
      borrowed: 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400',
      returned: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300',
      returning: 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400',
      rejected: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300',
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Peminjaman</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Kelola permintaan peminjaman dan pengembalian barang
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600 dark:text-primary-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari pengguna atau barang..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 focus:border-primary-500 dark:focus:border-primary-400 rounded-xl outline-none text-sm font-medium transition-all"
            />
          </div>

          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="relative group">
              <FiBarChart2 className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600 dark:text-primary-400 h-4 w-4 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-gray-400"
              >
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu</option>
                <option value="approved">Disetujui</option>
                <option value="borrowed">Dipinjam</option>
                <option value="returned">Dikembalikan</option>
                <option value="rejected">Ditolak</option>
                <option value="overdue">Terlambat</option>
              </select>
            </div>

            <div className="relative group">
              <FiUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600 dark:text-primary-400 h-4 w-4 pointer-events-none" />
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-gray-400"
              >
                <option value="all">Semua Pengguna</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.fullName}</option>
                ))}
              </select>
            </div>

            <div className="relative group col-span-2 md:col-span-1">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600 dark:text-primary-400 h-4 w-4 pointer-events-none" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-gray-400"
              >
                <option value="all">Semua Waktu</option>
                <option value="today">Hari Ini</option>
                <option value="week">Minggu Ini</option>
                <option value="month">Bulan Ini</option>
                <option value="custom">Rentang Khusus</option>
              </select>
            </div>
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group overflow-hidden rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30">
                <label className="text-[9px] font-black text-primary-500 uppercase tracking-widest absolute top-2 left-10 z-10">Dari Tanggal</label>
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 h-4 w-4" />
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full pl-10 pr-4 pt-6 pb-2 bg-transparent outline-none text-sm font-bold text-gray-700 dark:text-gray-200"
                />
              </div>
              <div className="relative group overflow-hidden rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30">
                <label className="text-[9px] font-black text-primary-500 uppercase tracking-widest absolute top-2 left-10 z-10">Sampai Tanggal</label>
                <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500 h-4 w-4" />
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="table-header">Barang</th>
                    <th className="table-header">Pengguna</th>
                    <th className="table-header">Jumlah</th>
                    <th className="table-header">Tujuan</th>
                    <th className="table-header">Tgl Pinjam</th>
                    <th className="table-header">Tgl Kembali</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredBorrowings.map((borrowing) => (
                    <tr key={borrowing.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="table-cell">
                        <div className="flex items-center">
                          <FiPackage className="mr-2 text-primary-600 dark:text-primary-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {typeof borrowing.item === 'object' ? borrowing.item.name : 'Memuat...'}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className="font-medium text-gray-900 dark:text-white flex items-center">
                          {typeof borrowing.user === 'object' ? borrowing.user.fullName : 'Memuat...'}
                          {typeof borrowing.user === 'object' && borrowing.user.isBlockedFromBorrowing && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-black bg-red-100 text-red-600 border border-red-200 uppercase tracking-tighter" title="User ini sedang ditangguhkan dari peminjaman baru">
                              <FiAlertCircle className="mr-0.5" /> Akun Terblokir
                            </span>
                          )}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {typeof borrowing.user === 'object' ? borrowing.user.nip : ''}
                        </div>
                      </td>
                      <td className="table-cell font-bold text-primary-600 dark:text-primary-400">{borrowing.quantity}</td>
                      <td className="table-cell">
                        <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 max-w-[150px]" title={borrowing.purpose}>
                          {borrowing.purpose || '-'}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center text-xs">
                          <FiCalendar className="mr-1.5 text-primary-600 dark:text-primary-400" />
                          {format(new Date(borrowing.borrowDate), 'dd MMM yyyy')}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center text-xs">
                          <FiCalendar className="mr-1.5 text-primary-600 dark:text-primary-400" />
                          <span className={isOverdue(borrowing) ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                            {format(new Date(borrowing.expectedReturnDate), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-col space-y-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(borrowing.status)}`}>
                            {getStatusIcon(borrowing.status)}
                            {statusLabels[borrowing.status] || borrowing.status}
                          </span>
                          {borrowing.status === 'overdue' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-orange-100 text-orange-600 border border-orange-200">
                              <FiAlertCircle className="mr-1" size={10} /> Peringatan H+1
                            </span>
                          )}
                          {borrowing.penaltyStatus === 'unpaid' && borrowing.penalty > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-600 text-white animate-pulse-subtle">
                              Denda Belum Lunas
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleView(borrowing)}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            <FiEye size={18} />
                          </button>
                          {user?.role === 'officer' && (
                            <>
                              {borrowing.status === 'pending' && (
                                <>
                                  <button onClick={() => handleAction(borrowing, 'approve')} className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><FiCheck size={18} /></button>
                                  <button onClick={() => handleAction(borrowing, 'reject')} className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"><FiX size={18} /></button>
                                </>
                              )}
                              {borrowing.status === 'approved' && (
                                <button
                                  onClick={() => handleAction(borrowing, 'take')}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors flex items-center"
                                  title="Mark as Picked Up"
                                >
                                  <FiPackage size={18} className="mr-1" />
                                  <span className="text-xs font-bold uppercase">Serahkan</span>
                                </button>
                              )}
                              {borrowing.status === 'returning' && (
                                <button
                                  onClick={() => handleAction(borrowing, 'approve_return')}
                                  className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors flex items-center"
                                  title="Approve Return"
                                >
                                  <FiCheck size={18} className="mr-1" />
                                  <span className="text-xs font-bold uppercase">Terima</span>
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

            <div className="md:hidden space-y-4 p-4">
              {filteredBorrowings.map((borrowing) => (
                <div key={borrowing.id} className="card p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <div className="bg-gray-50 dark:bg-slate-800 p-2 rounded-xl">
                        <FiPackage className="text-primary-600 dark:text-primary-400" size={20} />
                      </div>
                      <div className="ml-3">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                          {typeof borrowing.item === 'object' ? borrowing.item.name : 'Barang Tidak Diketahui'}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center">
                          {typeof borrowing.user === 'object' ? borrowing.user.fullName : 'Pengguna Tidak Diketahui'}
                          {typeof borrowing.user === 'object' && borrowing.user.isBlockedFromBorrowing && (
                            <span className="ml-1.5 inline-flex items-center text-[7px] font-black bg-red-100 text-red-600 px-1 py-0.5 rounded uppercase tracking-tighter ring-1 ring-red-200">
                              <FiAlertCircle className="mr-0.5" /> Terblokir
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(borrowing.status)}`}>
                        {statusLabels[borrowing.status] || borrowing.status}
                      </span>
                      {borrowing.status === 'overdue' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase bg-orange-100 text-orange-600 border border-orange-200">
                          <FiAlertCircle className="mr-0.5" size={8} /> H+1
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Jumlah</p>
                      <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{borrowing.quantity}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Kembali Sebelum</p>
                      <p className={`text-sm dark:text-gray-300 ${isOverdue(borrowing) ? 'text-red-600 font-bold' : ''}`}>
                        {format(new Date(borrowing.expectedReturnDate), 'dd/MM/yyyy')}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tujuan Peminjaman</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 italic">"{borrowing.purpose || '-'}"</p>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      <button onClick={() => handleView(borrowing)} className="p-2 bg-gray-50 dark:bg-slate-800 text-primary-600 rounded-xl"><FiEye size={16} /></button>
                      {user?.role === 'officer' && (
                        <>
                          {borrowing.status === 'pending' && (
                            <>
                              <button onClick={() => handleAction(borrowing, 'approve')} className="p-2 bg-gray-50 dark:bg-slate-800 text-primary-600 rounded-xl" title="Setujui"><FiCheck size={16} /></button>
                              <button onClick={() => handleAction(borrowing, 'reject')} className="p-2 bg-gray-50 dark:bg-slate-800 text-red-600 rounded-xl" title="Tolak"><FiX size={16} /></button>
                            </>
                          )}
                          {borrowing.status === 'approved' && (
                            <button
                              onClick={() => handleAction(borrowing, 'take')}
                              className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-xl flex items-center text-[10px] font-extrabold uppercase"
                              title="Serahkan Barang"
                            >
                              <FiPackage size={14} className="mr-1" /> Serahkan
                            </button>
                          )}
                          {borrowing.status === 'returning' && (
                            <button
                              onClick={() => handleAction(borrowing, 'approve_return')}
                              className="px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-xl flex items-center text-[10px] font-extrabold uppercase"
                              title="Terima Pengembalian"
                            >
                              <FiCheck size={14} className="mr-1" /> Terima
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-tight">
                  {actionType === 'take' ? 'Konfirmasi Penyerahan Barang' : (statusLabels[actionType] || actionType) + ' Permintaan'}
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  {actionType === 'take' ? 'Apakah pengguna sudah mengambil barang secara fisik?' : `Apakah Anda yakin ingin melakukan aksi ini?`}
                </p>

                {(actionType === 'approve' || actionType === 'reject') && (
                  <div className="mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600">
                    <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1.5 text-center">Tujuan Peminjaman</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic text-center leading-relaxed font-medium">
                      "{selectedBorrowing.purpose || 'Tanpa keterangan tujuan.'}"
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {actionType === 'approve_return' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Kondisi Setelahnya</label>
                        <select
                          value={selectedCondition}
                          onChange={(e) => setSelectedCondition(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl outline-none text-sm font-bold"
                        >
                          <option value="good">Baik (Normal)</option>
                          <option value="broken">Rusak (Rusak)</option>
                        </select>
                      </div>

                      {selectedCondition === 'broken' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5 flex justify-between">
                            <span>Jumlah Denda (Rp)</span>
                            <span className="text-[9px] lowercase italic text-red-400 font-medium">Pembayaran dilakukan di luar aplikasi</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">Rp</span>
                            <input
                              type="number"
                              value={penaltyAmount}
                              onChange={(e) => setPenaltyAmount(e.target.value)}
                              placeholder="Contoh: 50000"
                              className="w-full pl-12 pr-4 py-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl outline-none text-sm font-black text-red-600 dark:text-red-400 placeholder:text-red-300"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Catatan (Opsional)</label>
                    <textarea
                      value={actionNotes}
                      onChange={(e) => setActionNotes(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl outline-none text-sm min-h-[100px]"
                      placeholder="Tambahkan catatan untuk aksi ini..."
                    />
                  </div>
                </div>

                <div className="mt-8 flex space-x-3">
                  <button
                    onClick={() => setIsActionModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={performAction}
                    className={`flex-1 py-3 text-white font-bold rounded-xl text-xs uppercase tracking-widest shadow-lg transition-all ${actionType === 'reject' ? 'bg-red-600 shadow-red-500/20 hover:bg-red-700' : 'bg-primary-600 shadow-primary-500/20 hover:bg-primary-700'}`}
                  >
                    Konfirmasi
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Detail Peminjaman</h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Barang</p>
                      <p className="font-bold text-gray-900 dark:text-white">{typeof viewingBorrowing.item === 'object' ? viewingBorrowing.item.name : 'Memuat...'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Jumlah</p>
                      <p className="font-bold text-primary-600">{viewingBorrowing.quantity}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Pengguna</p>
                      <p className="font-bold text-gray-900 dark:text-white">{typeof viewingBorrowing.user === 'object' ? viewingBorrowing.user.fullName : 'Memuat...'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">NIP</p>
                      <p className="font-bold text-gray-900 dark:text-white">{typeof viewingBorrowing.user === 'object' ? viewingBorrowing.user.nip : 'Memuat...'}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-100 dark:border-slate-600">
                    <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-1.5">Tujuan Peminjaman</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed">
                      "{viewingBorrowing.purpose || 'Tidak ada keterangan tujuan.'}"
                    </p>
                  </div>

                  {viewingBorrowing.penalty > 0 && (
                    <div className="p-5 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Denda Kerusakan</p>
                          <p className="text-xl font-black text-red-600 dark:text-red-400">Rp {Number(viewingBorrowing.penalty).toLocaleString('en-US')}</p>
                        </div>
                        <div className="text-right space-y-2">
                          <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${viewingBorrowing.penaltyStatus === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse-subtle'}`}>
                            {viewingBorrowing.penaltyStatus === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}
                          </span>
                          {(user?.role === 'officer' || user?.role === 'admin') && (
                            <button
                              onClick={() => handleTogglePenaltyStatus(viewingBorrowing)}
                              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewingBorrowing.penaltyStatus === 'paid' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-green-600 text-white hover:bg-green-700 shadow-md shadow-green-500/20'}`}
                            >
                              {viewingBorrowing.penaltyStatus === 'paid' ? 'Tandai Belum Lunas' : 'Konfirmasi Pembayaran'}
                            </button>
                          )}
                        </div>
                      </div>
                      {viewingBorrowing.notes && (
                        <div className="mt-4 pt-4 border-t border-red-100 dark:border-red-900/30">
                          <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Catatan Petugas</p>
                          <p className="text-sm text-red-700 dark:text-red-300 italic">"{viewingBorrowing.notes}"</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-8 flex justify-end">
                  <button onClick={() => setIsViewModalOpen(false)} className="px-6 py-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 transition-all">Tutup</button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Borrowings;