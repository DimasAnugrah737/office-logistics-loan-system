import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FiSearch,
  FiArrowRight,
  FiActivity,
  FiFileText,
  FiEye
} from 'react-icons/fi';
import BorrowerDashboard from './BorrowerDashboard';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

/**
 * Komponen Utama Dashboard
 * Menampilkan statistik ringkasan, tren peminjaman, dan aktivitas terbaru.
 * Tampilan berbeda antara Admin/Petugas (statistik global) dan Peminjam (statistik pribadi).
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isOfficer, loading: authLoading } = useAuth();
  const socket = useSocket();
  
  // State untuk menyimpan data statistik ringkasan
  const [stats, setStats] = useState(null);
  
  // State untuk menyimpan daftar 5 transaksi peminjaman terbaru
  const [recentBorrowings, setRecentBorrowings] = useState([]);
  
  // State indikator pemuatan data dari API
  const [loading, setLoading] = useState(true);

  // Warna tema dinamis berdasarkan peran pengguna untuk grafik/ikon
  const themeColor = isAdmin ? '#3b60c1' : isOfficer ? '#2d7d46' : '#2563eb';

  // Efek untuk mengambil data saat komponen dimuat atau status autentikasi berubah
  useEffect(() => {
    if (!authLoading) {
      fetchDashboardData();
    }
  }, [authLoading, isAdmin, isOfficer]);

  // Efek untuk pembaruan data real-time menggunakan Socket.io
  useEffect(() => {
    if (!socket) return;
    
    const handleDataUpdate = () => fetchDashboardData();
    
    // Dengarkan event perubahan data dari server
    socket.on('item:created', handleDataUpdate);
    socket.on('item:updated', handleDataUpdate);
    socket.on('borrowing:created', handleDataUpdate);
    socket.on('borrowing:approved', handleDataUpdate);
    
    // Pembersihan listener saat komponen tidak lagi digunakan
    return () => {
      socket.off('item:created', handleDataUpdate);
      socket.off('item:updated', handleDataUpdate);
      socket.off('borrowing:created', handleDataUpdate);
      socket.off('borrowing:approved', handleDataUpdate);
    };
  }, [socket]);

  /**
   * Mengambil data statistik dari backend
   * Logika dipisah antara Admin/Petugas (seluruh departemen) dan User (pribadi saja)
   */
  const fetchDashboardData = async () => {
    try {
      if (isAdmin || isOfficer) {
        // Mode Petugas/Admin: Ambil statistik global dan semua peminjaman terbaru
        const statsData = await borrowingsAPI.getDashboardStats().catch(e => ({}));
        const response = await borrowingsAPI.getAllBorrowings({ limit: 5 }).catch(e => ({ borrowings: [] }));
        setStats(statsData);
        setRecentBorrowings(Array.isArray(response.borrowings) ? response.borrowings : []);
      } else {
        // Mode Peminjam: Ambil riwayat pribadi dan hitung ringkasan secara manual di frontend
        const borrowingsData = await borrowingsAPI.getUserBorrowingHistory().catch(e => []);
        setStats({
          overdueBorrowings: borrowingsData.filter(b => b.status === 'overdue').length,
          pendingBorrowings: borrowingsData.filter(b => b.status === 'pending').length,
          activeBorrowings: borrowingsData.filter(b => (b.status === 'borrowed' || b.status === 'returning')).length,
        });
        setRecentBorrowings(borrowingsData.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tampilan loading (Premium dengan spinner halus)
  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary"></div></div>;
  
  // Jika pengguna bukan admin/petugas, alihkan tampilan ke Dashboard khusus Peminjam (Optimasi Mobile)
  if (!isAdmin && !isOfficer) return <BorrowerDashboard />;

  // Definisi kartu statistik untuk bagian atas dashboard
  const statCards = [
    { title: 'Total Items', value: stats?.totalItems || 0, icon: <FiShoppingBag size={24} />, link: '/items', color: 'text-theme-primary' },
    { title: 'Requests', value: stats?.pendingBorrowings || 0, icon: <FiTrendingUp size={24} />, link: '/borrowings', color: 'text-rose-500' },
    { title: 'Overdue', value: stats?.overdueBorrowings || 0, icon: <FiClock size={24} />, link: '/borrowings?status=overdue', color: 'text-red-600' },
    { title: 'Users', value: stats?.totalUsers || 0, icon: <FiUsers size={24} />, link: '/users', color: 'text-amber-500' },
  ];

  return (
    <div className="space-y-10 animate-fade-in-up">
      {/* 1. Baris Kartu Statistik Utama */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((card, idx) => (
          <div 
            key={idx} 
            onClick={() => navigate(card.link)}
            className="bg-white dark:bg-slate-800 rounded-none p-4 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
          >
            <div className="flex justify-between items-start mb-2 sm:mb-4">
              <div>
                <p className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1 sm:mb-3">{card.title}</p>
                <h3 className="text-lg sm:text-2xl font-black text-gray-800 dark:text-white tracking-tight leading-none">{card.value}</h3>
              </div>
              <div className={`p-2 sm:p-3.5 rounded-none bg-gray-50 dark:bg-slate-700/50 ${card.color} group-hover:scale-110 transition-transform`}>
                {React.cloneElement(card.icon, { size: 16, className: 'sm:w-6 sm:h-6' })}
              </div>
            </div>
            <div className="flex items-center text-[10px] font-black text-theme-primary uppercase tracking-widest group-hover:gap-2 transition-all">
               View Details <FiArrowRight className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>

      {/* 2. Grafik Tren Visual (Area Chart dari Recharts) */}
      <div className="bg-white dark:bg-slate-800 rounded-none p-6 sm:p-12 shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-slate-700/50">
        <div className="flex justify-between items-center mb-12">
          <h3 className="text-2xl font-extrabold text-[#101010] dark:text-white tracking-tight">Monthly Borrowing Trend</h3>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-none" style={{ backgroundColor: themeColor }} />
            <span className="text-sm font-bold opacity-80" style={{ color: themeColor }}>Borrowings</span>
          </div>
        </div>

        <div className="w-full overflow-x-auto scrollbar-none">
          <div className="h-[450px] min-w-[700px] w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={stats?.monthlyTrends || []} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                 <defs>
                   <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor={themeColor} stopOpacity={0.2}/>
                     <stop offset="95%" stopColor={themeColor} stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                 <XAxis 
                    dataKey="_id.month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fontWeight: 600, fill: themeColor }} 
                    dy={20}
                    tickFormatter={(val) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][val-1]}
                 />
                 <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 13, fontWeight: 600, fill: themeColor }} 
                    dx={-15}
                 />
                 <Tooltip 
                    cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '5 5' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-slate-800 p-0 rounded-none shadow-2xl relative -top-20 animate-in zoom-in duration-200" style={{ borderColor: themeColor, borderWidth: '4px' }}>
                            <div className="text-white px-8 py-4 rounded-none" style={{ backgroundColor: themeColor }}>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1 text-center">{new Date().getFullYear()}</p>
                              <div className="flex items-center justify-center gap-3">
                                 <div className="w-2.5 h-2.5 rounded-none bg-white animate-pulse shadow-[0_0_10px_white]" />
                                 <p className="text-2xl font-black">{payload[0].value}</p>
                              </div>
                            </div>
                            {/* Tooltip Triangle Indicator */}
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45" style={{ backgroundColor: themeColor }} />
                          </div>
                        );
                      }
                      return null;
                    }}
                 />
                 <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke={themeColor} 
                    strokeWidth={8} 
                    fillOpacity={1} 
                    fill="url(#colorCount)"
                    animationDuration={2000}
                    dot={{ r: 0 }}
                    activeDot={{ r: 10, strokeWidth: 4, stroke: '#fff', fill: themeColor }}
                 />
               </AreaChart>
             </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Tabel Aktivitas Peminjaman Terbaru */}
      <div className="bg-white dark:bg-slate-800 rounded-none shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden">
        <div className="px-10 py-8 border-b border-gray-100 dark:border-slate-700/50 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/80">
           <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">Borrowing Activity</h3>
           <button className="text-xs font-black text-theme-primary uppercase tracking-widest hover:underline" onClick={() => navigate('/borrowings')}>See All</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/30 dark:bg-slate-800/50">
                <th className="px-10 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Item</th>
                <th className="px-10 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Borrower</th>
                <th className="px-10 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-10 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {recentBorrowings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition-colors group">
                  <td className="px-10 py-6">
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{b.item?.name}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-wider">{b.item?.category?.name}</p>
                  </td>
                  <td className="px-10 py-6">
                    <p className="text-sm font-bold text-gray-800 dark:text-white">{b.user?.fullName}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-wider">{b.user?.department}</p>
                  </td>
                  <td className="px-10 py-6">
                    <span className={`px-4 py-1.5 rounded-none text-[9px] font-black uppercase tracking-widest ${
                      b.status === 'borrowed' ? 'bg-emerald-50 text-emerald-600' : 
                      b.status === 'pending' ? 'bg-amber-50 text-amber-600' : 
                      b.status === 'overdue' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button onClick={() => navigate('/borrowings')} className="p-2.5 rounded-none bg-gray-50 dark:bg-slate-700 group-hover:bg-primary-600 group-hover:text-white transition-all" title="View Details">
                      <FiEye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;