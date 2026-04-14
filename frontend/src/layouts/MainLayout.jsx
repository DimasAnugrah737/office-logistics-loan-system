import React, { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  FiHome,
  FiUsers,
  FiPackage,
  FiGrid,
  FiCalendar,
  FiBell,
  FiLogOut,
  FiMenu,
  FiX,
  FiMoon,
  FiSun,
  FiBarChart2,
  FiFileText,
  FiUser,
  FiRefreshCw,
} from 'react-icons/fi';
import Logo from '../components/Logo';

const MainLayout = () => {
  const { user, logout, toggleTheme, theme, isAdmin, isOfficer } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  // Navigasi untuk Admin
  const adminNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiHome /> },
    { path: '/users', label: 'Users', icon: <FiUsers /> },
    { path: '/items', label: 'Items', icon: <FiPackage /> },
    { path: '/categories', label: 'Categories', icon: <FiGrid /> },
    { path: '/borrowings', label: 'Borrowings', icon: <FiCalendar /> },
    { path: '/reports', label: 'Reports', icon: <FiBarChart2 /> },
    { path: '/activity-logs', label: 'Activity Logs', icon: <FiFileText /> },
  ];

  // Navigasi untuk Petugas (Officer)
  const officerNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiHome /> },
    { path: '/users', label: 'Users', icon: <FiUsers /> },
    { path: '/items', label: 'Items', icon: <FiPackage /> },
    { path: '/borrowings', label: 'Borrowings', icon: <FiCalendar /> },
    { path: '/reports', label: 'Reports', icon: <FiBarChart2 /> },
  ];

  // Navigasi untuk User biasa
  const userNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiHome /> },
    { path: '/browse-items', label: 'Browse Items', icon: <FiPackage /> },
    { path: '/my-borrowings', label: 'My Borrowings', icon: <FiCalendar /> },
  ];

  const navItems = isAdmin ? adminNavItems : isOfficer ? officerNavItems : userNavItems;

  const isActive = (path) => location.pathname.startsWith(path);

  // Pengaturan gaya berdasarkan peran user
  const style = (isAdmin || isOfficer) ? {
    bg: isAdmin ? 'bg-[#3b60c1]' : 'bg-[#2d7d46]', // Biru untuk Admin, Hijau untuk Petugas
    text: 'text-white',
    activeItem: 'bg-white shadow-xl',
    activeText: isAdmin ? 'text-[#3b60c1]' : 'text-[#2d7d46]',
    inactiveItem: 'text-white/80 hover:bg-white/10 hover:text-white',
    iconActive: isAdmin ? 'text-[#3b60c1]' : 'text-[#2d7d46]',
    iconInactive: 'text-white/60 group-hover:text-white',
    headerBg: 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-md',
    headerHeight: 'h-20',
    contentPadding: 'p-6 lg:p-10'
  } : {
    bg: 'bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700',
    text: 'text-gray-900 dark:text-white',
    activeItem: 'bg-theme-primary shadow-lg shadow-theme-primary/30',
    activeText: 'text-white',
    inactiveItem: 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50 hover:text-gray-900',
    iconActive: 'text-white',
    iconInactive: 'text-gray-400 group-hover:text-theme-primary',
    headerBg: 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-md',
    headerHeight: 'h-16',
    contentPadding: 'p-4 sm:p-6 lg:p-8'
  };

  return (
    <div className={`h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden ${isOfficer ? 'theme-officer' : ''}`}>
      {/* Backdrop sidebar mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-50 w-56 transform ${style.bg} transition duration-500 ease-in-out ${(!isAdmin && !isOfficer) ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : (sidebarOpen ? 'translate-x-0' : 'lg:translate-x-0 -translate-x-full')
          } h-screen flex flex-col shadow-[20px_0_40px_-15px_rgba(0,0,0,0.1)]`}
      >
        {/* Header Sidebar / Logo */}
        <div className={`flex flex-col items-center justify-center pt-16 pb-12 overflow-hidden relative ${(isAdmin || isOfficer) ? '' : 'border-b dark:border-gray-700'}`}>
          {/* Efek cahaya halus untuk sidebar berwarna */}
          {(isAdmin || isOfficer) && (
            <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-none blur-[80px] bg-white/20`} />
          )}

          <Link to="/dashboard" className="flex flex-col items-center group relative z-10 w-full px-4 overflow-hidden">
            <Logo
              className={`transition-colors duration-300 ${(isAdmin || isOfficer) ? 'text-white' : 'text-theme-primary'}`}
              showText={true}
            />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-6 right-6 lg:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="flex-1 px-6 py-6 overflow-y-auto scrollbar-none">
          {/* Navigasi */}
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-none transition-all duration-300 group ${isActive(item.path)
                  ? `${style.activeItem} ${style.activeText}`
                  : `${style.inactiveItem}`
                  }`}
                onClick={() => setSidebarOpen(false)}
                title={item.label}
              >
                <span className={`mr-4 transition-transform duration-300 ${isActive(item.path) ? `scale-110 ${style.iconActive}` : `${style.iconInactive} group-hover:translate-x-1`}`}>
                  {React.cloneElement(item.icon, { size: 16 })}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Aksi Bawah Sidebar */}
        <div className={`p-6 border-t ${(isAdmin || isOfficer) ? 'border-white/10' : 'dark:border-gray-700'}`}>
          {/* Tombol Logout Sidebar untuk Admin/Petugas */}
          {(isAdmin || isOfficer) && (
            <button
              onClick={() => handleLogout()}
              className="w-full flex items-center justify-center px-4 py-4 rounded-none mb-3 transition-all duration-300 font-black uppercase tracking-widest text-[9px] bg-white/5 text-white hover:bg-black/20"
            >
              <FiLogOut size={16} className="mr-3" /> LOGOUT
            </button>
          )}

          {/* Pengalih Tema di Sidebar (Hanya Mobile) */}
          <button
            onClick={() => toggleTheme()}
            className={`w-full flex lg:hidden items-center justify-center px-4 py-4 rounded-none mb-3 transition-all duration-300 font-black uppercase tracking-widest text-[9px] ${(isAdmin || isOfficer) ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-gray-50 text-gray-500'}`}
          >
            {theme === 'light' ? (
              <><FiMoon size={16} className="mr-3" /> DARK MODE</>
            ) : (
              <><FiSun size={16} className="mr-3" /> LIGHT MODE</>
            )}
          </button>
        </div>
      </div>

      {/* Konten utama */}
      <div className={`flex-1 transition-all duration-500 ${(!isAdmin && !isOfficer) ? 'lg:ml-0' : 'lg:ml-56'} h-screen flex flex-col overflow-hidden`}>
        {/* Navbar Atas */}
        <header className={`sticky top-0 z-40 ${style.headerBg}`}>
          <div className="w-full px-4 sm:px-6 lg:px-10">
            <div className={`flex items-center justify-between ${style.headerHeight}`}>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 lg:hidden"
                >
                  <FiMenu size={24} />
                </button>

                {/* Logo Desktop untuk User Biasa (Karena sidebar disembunyikan) */}
                {!isAdmin && !isOfficer && (
                  <Link to="/dashboard" className="hidden lg:flex items-center gap-2 mr-8 pr-10 border-r-2 border-gray-100 dark:border-gray-700 select-none group">
                    <span className="text-xl font-black tracking-tighter text-theme-primary uppercase group-hover:scale-105 transition-transform">
                      OFFICE
                    </span>
                    <span className="text-[8px] font-black tracking-widest text-gray-400 uppercase opacity-60">EQUIPMENT</span>
                  </Link>
                )}

                {(isAdmin || isOfficer) && (
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white capitalize tracking-tighter">
                    {location.pathname === '/dashboard' ? 'Dashboard' : location.pathname.split('/').pop().replace('-', ' ')}
                  </h2>
                )}

                {/* Navigasi Horizontal untuk User Biasa (Hanya Desktop) */}
                {!isAdmin && !isOfficer && (
                  <nav className="hidden lg:flex items-center ml-12 space-x-1">
                    {userNavItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 relative group ${isActive(item.path)
                          ? 'text-theme-primary'
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                          }`}
                      >
                        <span className="relative z-10">{item.label}</span>
                        {isActive(item.path) ? (
                          <span className="absolute bottom-0 left-5 right-5 h-0.5 bg-theme-primary rounded-full animate-in fade-in zoom-in duration-300" />
                        ) : (
                          <span className="absolute bottom-0 left-5 right-5 h-0.5 bg-theme-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full" />
                        )}
                      </Link>
                    ))}
                  </nav>
                )}
              </div>

              <div className="flex-1" />

              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* Pengalih Tema (Hanya Desktop) */}
                <button
                  onClick={() => toggleTheme()}
                  className="hidden lg:flex p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all"
                >
                  {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
                </button>

                {/* Notifikasi */}
                <div className="relative">
                  <button
                    onClick={() => setNotificationOpen(!notificationOpen)}
                    className={`p-2.5 rounded-none transition-all relative ${notificationOpen ? 'bg-theme-primary-light text-theme-primary' : 'text-gray-400 hover:bg-gray-50'}`}
                    aria-label="Notifications"
                  >
                    {loading ? (
                      <FiRefreshCw size={20} className="animate-spin text-theme-primary" />
                    ) : (
                      <FiBell size={20} />
                    )}
                    {!loading && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white ring-2 ring-white animate-in zoom-in duration-300">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notificationOpen && (
                    <>
                      <div className="fixed inset-0 z-[100]" onClick={() => setNotificationOpen(false)} />
                      <div className="fixed sm:absolute top-16 sm:top-auto left-4 right-4 sm:left-auto sm:right-0 mt-3 sm:w-80 bg-white dark:bg-gray-800 rounded-none shadow-2xl z-[101] border border-gray-100 dark:border-gray-700/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 sm:p-4 border-b dark:border-gray-700 flex items-center justify-between">
                          <h3 className="font-bold text-gray-900 dark:text-white uppercase tracking-widest text-[9px] sm:text-[10px]">Notifications</h3>
                          {notifications.length > 0 && (
                            <button onClick={markAllAsRead} className="text-[9px] sm:text-[10px] font-bold text-primary-600 uppercase">Mark all as read</button>
                          )}
                        </div>
                        <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto scrollbar-none">
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 italic text-xs">No notifications</div>
                          ) : (
                            notifications.map((n, idx) => {
                              const notifId = n._id || n.id;
                              return (
                                <div key={notifId || idx} onClick={() => { if (notifId) markAsRead(notifId); navigate(n.path || '/borrowings'); setNotificationOpen(false); }}
                                  className={`p-3 sm:p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${!n.isRead ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                                  <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-tight mb-0.5">{n.title}</p>
                                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{n.message}</p>
                                  <p className="text-[8px] sm:text-[9px] text-gray-400 mt-1.5 font-bold uppercase tracking-wider">{new Date(n.createdAt).toLocaleDateString()}</p>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <div className="p-3 border-t dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                          <button
                            onClick={() => { navigate('/notifications'); setNotificationOpen(false); }}
                            className="w-full py-2 text-[10px] font-black text-theme-primary uppercase tracking-widest hover:underline text-center"
                          >
                            View All Notifications
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Profil Pengguna */}
                <div className="flex items-center gap-2 sm:gap-4 pl-3 sm:pl-6 border-l border-gray-100 dark:border-gray-700 relative">
                  <div className="text-right hidden md:block">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">
                      {user?.role === 'admin' ? 'Administrator' : user?.role === 'officer' ? 'Officer' : 'Borrower'}
                    </p>
                    <p className="text-xs font-bold text-gray-900 dark:text-white leading-none">{user?.fullName}</p>
                  </div>
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="w-11 h-11 rounded-none overflow-hidden bg-gray-100 border-2 border-white dark:border-gray-700 shadow-sm transition-all hover:scale-110 active:scale-95"
                  >
                    <img
                      src={`https://ui-avatars.com/api/?name=${user?.fullName}&background=${isAdmin ? '3b60c1' : isOfficer ? '2d7d46' : '2563eb'}&color=fff&bold=true`}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </button>

                  {profileOpen && (
                    <>
                      <div className="fixed inset-0 z-[100]" onClick={() => setProfileOpen(false)} />
                      <div className="absolute right-0 mt-48 w-48 bg-white dark:bg-gray-800 rounded-none shadow-2xl z-[101] border border-gray-100 dark:border-gray-700/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b dark:border-gray-700">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Signed in as</p>
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{user?.fullName}</p>
                        </div>
                        <div className="py-2">
                          <button
                            onClick={() => { navigate('/profile'); setProfileOpen(false); }}
                            className="w-full flex items-center px-4 py-3 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <FiUser className="mr-3" /> Profile
                          </button>
                          {(!isAdmin && !isOfficer) && (
                            <button
                              onClick={() => { handleLogout(); setProfileOpen(false); }}
                              className="w-full flex items-center px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            >
                              <FiLogOut className="mr-3" /> Logout
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Konten halaman */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden ${style.contentPadding}`}>
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;