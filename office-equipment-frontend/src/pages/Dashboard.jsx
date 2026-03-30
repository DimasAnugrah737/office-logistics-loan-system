import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { borrowingsAPI } from '../api/borrowings';
import { itemsAPI } from '../api/items';
import {
  FiPackage,
  FiUsers,
  FiCalendar,
  FiClock,
  FiTrendingUp,
  FiCheckCircle,
  FiAlertCircle,
  FiShoppingBag,
  FiSearch
} from 'react-icons/fi';
import BorrowerDashboard from './BorrowerDashboard';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

const Dashboard = () => {
  const { user, isAdmin, isOfficer, loading: authLoading } = useAuth();
  const socket = useSocket();
  const [stats, setStats] = useState(null);
  const [recentBorrowings, setRecentBorrowings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      fetchDashboardData();
    }
  }, [authLoading, isAdmin, isOfficer]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleDataUpdate = () => {
      fetchDashboardData();
    };

    // Listen for all data change events
    socket.on('item:created', handleDataUpdate);
    socket.on('item:updated', handleDataUpdate);
    socket.on('item:deleted', handleDataUpdate);
    socket.on('user:created', handleDataUpdate);
    socket.on('user:updated', handleDataUpdate);
    socket.on('user:deleted', handleDataUpdate);
    socket.on('borrowing:created', handleDataUpdate);
    socket.on('borrowing:approved', handleDataUpdate);
    socket.on('borrowing:rejected', handleDataUpdate);
    socket.on('borrowing:borrowed', handleDataUpdate);
    socket.on('borrowing:returned', handleDataUpdate);
    socket.on('borrowing:return_approved', handleDataUpdate);

    return () => {
      socket.off('item:created', handleDataUpdate);
      socket.off('item:updated', handleDataUpdate);
      socket.off('item:deleted', handleDataUpdate);
      socket.off('user:updated', handleDataUpdate);
      socket.off('user:deleted', handleDataUpdate);
      socket.off('user:created', handleDataUpdate);
      socket.off('borrowing:created', handleDataUpdate);
      socket.off('borrowing:approved', handleDataUpdate);
      socket.off('borrowing:rejected', handleDataUpdate);
      socket.off('borrowing:borrowed', handleDataUpdate);
      socket.off('borrowing:returned', handleDataUpdate);
      socket.off('borrowing:return_approved', handleDataUpdate);
    };
  }, [socket]);

  const fetchDashboardData = async () => {
    try {
      if (isAdmin || isOfficer) {
        const statsData = await borrowingsAPI.getDashboardStats().catch(e => ({
          totalItems: 0,
          totalUsers: 0,
          pendingBorrowings: 0,
          overdueBorrowings: 0,
          approvedBorrowings: 0,
          borrowedBorrowings: 0,
          returnedBorrowings: 0
        }));
        const response = await borrowingsAPI.getAllBorrowings({ limit: 5 }).catch(e => ({ borrowings: [] }));
        setStats(statsData);
        setRecentBorrowings(Array.isArray(response.borrowings) ? response.borrowings : []);
      } else {
        // User dashboard
        const borrowingsData = await borrowingsAPI.getUserBorrowingHistory().catch(e => []);
        setStats({
          overdueBorrowings: Array.isArray(borrowingsData) ? borrowingsData.filter(b => b.status === 'overdue').length : 0,
          totalUnpaidPenalties: Array.isArray(borrowingsData) ? borrowingsData.reduce((sum, b) => b.penaltyStatus === 'unpaid' ? sum + Number(b.penalty) : sum, 0) : 0,
          pendingBorrowings: Array.isArray(borrowingsData) ? borrowingsData.filter(b => b.status === 'pending').length : 0,
          activeBorrowings: Array.isArray(borrowingsData) ? borrowingsData.filter(b => (b.status === 'borrowed' || b.status === 'returning')).length : 0,
        });
        setRecentBorrowings(Array.isArray(borrowingsData) ? borrowingsData.slice(0, 5) : []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setStats({
        totalItems: 0,
        totalUsers: 0,
        pendingBorrowings: 0,
        overdueBorrowings: 0,
        returnedItems: 0,
        myBorrowings: 0,
        activeBorrowings: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      borrowed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      returned: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      returning: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return colors[status] || colors.pending;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAdmin && !isOfficer) {
    return <BorrowerDashboard />;
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Selamat datang kembali, {user?.fullName}!
          </p>
        </div>
      </div>

      {user?.isBlockedFromBorrowing && (
        <div className="bg-red-50 dark:bg-slate-800/80 border-l-4 border-red-500 rounded-2xl p-5 mb-6 shadow-sm flex items-start space-x-4 animate-in fade-in slide-in-from-left-4 duration-500 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <FiAlertCircle size={80} className="text-red-500 rotate-12" />
          </div>
          <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center border border-red-200 dark:border-red-800/50">
            <FiAlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-grow">
            <h4 className="text-base font-black text-red-800 dark:text-red-300 uppercase tracking-tight">Akun Ditangguhkan</h4>
            <div className="mt-1 space-y-1">
              <p className="text-sm font-bold text-red-700 dark:text-red-200">
                {user.blockReason || 'Anda memiliki masalah yang harus segera diselesaikan.'}
              </p>
              <p className="text-[11px] font-medium text-red-600/80 dark:text-red-400/80 max-w-2xl leading-relaxed">
                Silakan hubungi petugas sarana prasarana untuk menyelesaikan denda atau mengembalikan barang yang terlambat. Anda tidak dapat melakukan peminjaman baru sampai status akun diaktifkan kembali.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards - Updated column count based on role */}
      <div className={`grid grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 sm:gap-6`}>
        {(isAdmin || isOfficer) ? (
          <>
            <div className="card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-center border border-gray-100 dark:border-slate-700">
                <FiPackage className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500">
                  Total Barang
                </p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  {stats?.totalItems || 0}
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-center border border-gray-100 dark:border-slate-700">
                  <FiUsers className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500 truncate">
                    Total Pengguna
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                    {stats?.totalUsers || 0}
                  </p>
                </div>
              </div>
            )}

            <div className="card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                <FiAlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500 truncate">
                  Total Denda
                </p>
                <p className="text-sm sm:text-lg font-black text-gray-900 dark:text-white leading-tight truncate">
                  Rp {(stats?.totalUnpaidPenalties || 0).toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <div className="card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-50/50 dark:bg-slate-800/50 flex items-center justify-center border border-gray-100 dark:border-slate-700">
                <FiCalendar className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500">
                  Permintaan Menunggu
                </p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  {stats?.pendingBorrowings || 0}
                </p>
              </div>
            </div>

            <div className={`card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4 transition-all duration-300 ${stats?.overdueBorrowings > 0 ? 'ring-2 ring-red-500/20 bg-red-50/10' : ''}`}>
              <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border ${stats?.overdueBorrowings > 0 ? 'bg-red-500 text-white border-red-400 animate-pulse' : 'bg-gray-50/50 dark:bg-slate-800/50 text-primary-600 dark:text-primary-400 border-gray-100 dark:border-slate-700'}`}>
                <FiClock className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500 truncate">
                    Barang Terlambat
                  </p>
                  {stats?.overdueBorrowings > 0 && (
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                  )}
                </div>
                <p className={`text-xl sm:text-2xl font-black leading-tight ${stats?.overdueBorrowings > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {stats?.overdueBorrowings || 0}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-50/50 dark:bg-red-900/10 flex items-center justify-center border border-red-100 dark:border-red-900/30">
                <FiClock className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500">
                  Barang Terlambat
                </p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  {stats?.overdueBorrowings || 0}
                </p>
              </div>
            </div>

            <div className="card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                <FiAlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500 truncate">
                  Total Denda
                </p>
                <p className="text-sm sm:text-lg font-black text-gray-900 dark:text-white leading-tight truncate">
                  Rp {(stats?.totalUnpaidPenalties || 0).toLocaleString('id-ID')}
                </p>
              </div>
            </div>

            <div className="card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center border border-gray-200 dark:border-slate-700">
                <FiClock className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500">
                  Menunggu Persetujuan
                </p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  {stats?.pendingBorrowings || 0}
                </p>
              </div>
            </div>

            <div className="card !p-3 sm:!p-4 flex items-center space-x-3 sm:space-x-4">
              <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center border border-gray-200 dark:border-slate-700">
                <FiTrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest dark:text-slate-500">
                  Peminjaman Aktif
                </p>
                <p className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white leading-tight">
                  {stats?.activeBorrowings || 0}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Charts for Admin/Officer - Side by side even on mobile */}
      {
        (isAdmin || isOfficer) && stats && (
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <div className="card">
              <h3 className="text-[10px] sm:text-base font-bold text-gray-900 dark:text-white mb-2 sm:mb-6 uppercase tracking-wider">
                Tren Peminjaman
              </h3>
              <div className="h-[200px] sm:h-[400px] w-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200}>
                  <LineChart data={stats?.monthlyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="_id.month"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{ fontSize: window.innerWidth < 640 ? 8 : 10, fill: '#6b7280' }}
                      tickFormatter={(value) => {
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
                        return months[value - 1] || value;
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: window.innerWidth < 640 ? 8 : 10, fill: '#6b7280' }}
                      width={window.innerWidth < 640 ? 15 : 25}
                      allowDecimals={false}
                      domain={[0, 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(4px)'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={4}
                      dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                      name="Peminjaman"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3 className="text-[10px] sm:text-base font-bold text-gray-900 dark:text-white mb-2 sm:mb-6 uppercase tracking-wider">
                Distribusi Status
              </h3>
              <div className="h-[200px] sm:h-[400px] w-full mt-4 overflow-y-auto custom-scrollbar">
                <div className="space-y-3 sm:space-y-6 px-1">
                  {(stats?.statusStats || [])
                    .filter(stat => stat.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map((stat, index) => {
                      const total = stats.statusStats.reduce((sum, s) => sum + s.count, 0);
                      const percentage = total > 0 ? (stat.count / total) * 100 : 0;
                      const statusLabels = {
                        pending: 'Menunggu',
                        approved: 'Disetujui',
                        borrowed: 'Dipinjam',
                        returned: 'Dikembalikan',
                        returning: 'Proses Kembali',
                        rejected: 'Ditolak',
                        overdue: 'Terlambat',
                      };
                      const statusName = statusLabels[stat._id] || stat._id;
                      const color = getPieColor(stat._id);

                      return (
                        <div key={stat._id} className="group">
                          <div className="flex justify-between items-end mb-1 sm:mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-[9px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tight">
                                {statusName}
                              </span>
                            </div>
                            <div className="flex items-baseline space-x-1">
                              <span className="text-xs sm:text-lg font-black text-gray-900 dark:text-white leading-none">
                                {stat.count}
                              </span>
                              <span className="text-[8px] sm:text-[10px] font-bold text-gray-400">
                                ({percentage.toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 sm:h-3 w-full bg-gray-100 dark:bg-gray-700/50 rounded-full overflow-hidden border border-gray-200/50 dark:border-gray-600/30">
                            <div
                              className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: color,
                                boxShadow: `0 0 10px ${color}33`
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Recent Activity */}
      <div className="card overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 gap-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            {isAdmin || isOfficer ? 'Peminjaman Terbaru' : 'Peminjaman Saya Terbaru'}
          </h3>
          <button className="text-sm font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center">
            Lihat semua <FiTrendingUp className="ml-1 text-primary-600 dark:text-primary-400" />
          </button>
        </div>

        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="table-header">Barang</th>
                <th className="table-header">Jumlah</th>
                <th className="table-header">Tanggal Pinjam</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentBorrowings.map((borrowing) => (
                <tr key={borrowing.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="table-cell font-medium text-gray-900 dark:text-white">
                    {typeof borrowing.item === 'object' ? borrowing.item.name : 'Loading...'}
                  </td>
                  <td className="table-cell font-bold text-primary-600 dark:text-primary-400">{borrowing.quantity}</td>
                  <td className="table-cell text-xs text-gray-500">
                    {new Date(borrowing.borrowDate).toLocaleDateString()}
                  </td>
                  <td className="table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(borrowing.status)}`}>
                      {({
                        pending: 'Menunggu',
                        approved: 'Disetujui',
                        borrowed: 'Dipinjam',
                        returned: 'Dikembalikan',
                        returning: 'Proses Kembali',
                        rejected: 'Ditolak',
                        overdue: 'Terlambat',
                      })[borrowing.status] || borrowing.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {recentBorrowings.map((borrowing) => (
            <div key={borrowing.id} className="p-3 flex justify-between items-center">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {typeof borrowing.item === 'object' ? borrowing.item.name : 'Loading...'}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {new Date(borrowing.borrowDate).toLocaleDateString()}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-bold text-primary-600">Jml: {borrowing.quantity}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(borrowing.status)}`}>
                  {({
                    pending: 'Menunggu',
                    approved: 'Disetujui',
                    borrowed: 'Dipinjam',
                    returned: 'Dikembalikan',
                    returning: 'Proses Kembali',
                    rejected: 'Ditolak',
                    overdue: 'Terlambat',
                  })[borrowing.status] || borrowing.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div >
  );
};

const getPieColor = (status) => {
  const colors = {
    pending: '#3b82f6',
    approved: '#3b82f6',
    borrowed: '#3b82f6',
    returned: '#6b7280',
    returning: '#6366f1',
    rejected: '#6b7280',
    overdue: '#3b82f6',
  };
  return colors[status] || '#6b7280';
};

export default Dashboard;