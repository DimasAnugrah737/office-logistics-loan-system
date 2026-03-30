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
} from 'react-icons/fi';

const MainLayout = () => {
  const { user, logout, toggleTheme, theme, isAdmin, isOfficer } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  const adminNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiHome /> },
    { path: '/users', label: 'Pengguna', icon: <FiUsers /> },
    { path: '/items', label: 'Barang', icon: <FiPackage /> },
    { path: '/categories', label: 'Kategori', icon: <FiGrid /> },
    { path: '/borrowings', label: 'Peminjaman', icon: <FiCalendar /> },
    { path: '/activity-logs', label: 'Log Aktivitas', icon: <FiFileText /> },
  ];

  const officerNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiHome /> },
    { path: '/users', label: 'Pengguna', icon: <FiUsers /> },
    { path: '/items', label: 'Barang', icon: <FiPackage /> },
    { path: '/borrowings', label: 'Peminjaman', icon: <FiCalendar /> },
    { path: '/reports', label: 'Laporan', icon: <FiBarChart2 /> },
  ];

  const userNavItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <FiHome /> },
    { path: '/browse-items', label: 'Cari Barang', icon: <FiPackage /> },
    { path: '/my-borrowings', label: 'Peminjaman Saya', icon: <FiCalendar /> },
  ];

  const navItems = isAdmin ? adminNavItems : isOfficer ? officerNavItems : userNavItems;

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Backdrop for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 z-50 w-64 transform bg-white dark:bg-gray-800 shadow-2xl border-r border-gray-100 dark:border-gray-700 transition duration-500 ease-in-out ${(!isAdmin && !isOfficer) ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : (sidebarOpen ? 'translate-x-0' : 'lg:translate-x-0 -translate-x-full')
          } h-screen`}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b dark:border-gray-700">
          <Link to="/dashboard" className="flex items-center space-x-2 group">
            <div className="w-8 h-8 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center p-1.5 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-primary-100 dark:border-primary-800/50">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none group-hover:text-primary-600 transition-colors">
              Office<br /><span className="text-primary-600 font-extrabold text-[10px] tracking-widest">Equipment</span>
            </span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="flex flex-col h-[calc(100vh-64px)] px-4 py-6 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {/* User info card - Lead to profile */}
          <Link 
            to="/profile"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center p-3 mb-6 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 rounded-2xl flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all group"
          >
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
                <FiUser size={20} />
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-black text-gray-900 dark:text-white leading-tight truncate">
                {user?.fullName.split(' ')[0]}
              </p>
              <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter truncate">
                {user?.role === 'admin' ? 'Admin' : user?.role === 'officer' ? 'Petugas' : 'User'} • {user?.department || 'Kantor'}
              </p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="space-y-1.5 mb-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-2.5 sm:py-3 text-[10px] sm:text-sm font-bold uppercase tracking-widest rounded-xl sm:rounded-2xl transition-all duration-300 ${isActive(item.path)
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30 translate-x-1'
                  : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50 hover:text-gray-900 group'
                  }`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className={`mr-2.5 transition-colors ${isActive(item.path) ? 'text-white' : 'text-gray-400 group-hover:text-primary-500'}`}>
                  {React.cloneElement(item.icon, { size: 16 })}
                </span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Sidebar Bottom Actions */}
          <div className={`mt-auto pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2 flex-shrink-0 ${(isAdmin || isOfficer) ? 'flex flex-col' : 'lg:hidden'}`}>
            {/* Theme Toggle - Only visible in mobile sidebar for users without permanent sidebar */}
            {(!isAdmin && !isOfficer) && (
              <button
                onClick={() => toggleTheme()}
                className="w-full flex justify-center items-center py-2 bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 rounded-xl transition-all"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <FiMoon size={16} /> : <FiSun size={16} />}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-3 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-xl transition-all group"
              aria-label="Logout"
            >
              <FiLogOut size={16} className="mr-2 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Log Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`flex-1 ${(!isAdmin && !isOfficer) ? 'lg:ml-0' : 'lg:ml-64'} h-screen flex flex-col overflow-hidden transition-all duration-500`}>
        {/* Top navbar */}
        <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
              >
                <FiMenu size={24} />
              </button>

              {/* Branding & User Name - Visible when sidebar is hidden */}
              <div className={`flex items-center ml-2 sm:ml-4 ${(isAdmin || isOfficer) ? 'lg:hidden' : ''}`}>
                <Link to="/dashboard" className="flex items-center space-x-2 mr-3 group">
                  <div className="w-8 h-8 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center p-1.5 shadow-sm border border-primary-100 dark:border-primary-800/50 group-hover:scale-110 transition-transform">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tighter leading-none group-hover:text-primary-600 transition-colors">
                    Office<br /><span className="text-primary-600 font-extrabold text-[8px] tracking-widest">Equipment</span>
                  </span>
                </Link>
                {/* User Name Display - Clickable to Profile */}
                <Link to="/profile" className="border-l border-gray-200 dark:border-gray-700 pl-3 hover:text-primary-600 transition-colors group">
                  <p className="text-[10px] sm:text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight truncate max-w-[100px] sm:max-w-[150px] group-hover:text-primary-600 transition-colors">
                    Hi, {user?.fullName.split(' ')[0]}
                  </p>
                </Link>
              </div>

              <div className="flex-1" />

              <div className="flex items-center space-x-4">
                {/* Theme toggle - Always visible on desktop header */}
                <button
                  onClick={() => toggleTheme()}
                  className="hidden sm:flex p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
                </button>

                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setNotificationOpen(!notificationOpen)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative"
                    aria-label="Notifications"
                  >
                    <FiBell size={20} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                    )}
                  </button>

                  {notificationOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setNotificationOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-40">
                        <div className="p-4 border-b dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              Notifikasi
                            </h3>
                            {notifications.length > 0 && (
                              <button
                                onClick={markAllAsRead}
                                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                              >
                                Tandai semua dibaca
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                              Tidak ada notifikasi
                            </div>
                          ) : (
                            notifications.map((notification) => (
                              <div
                                key={notification._id}
                                className={`p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${!notification.isRead ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                                  }`}
                                onClick={() => {
                                  markAsRead(notification._id);
                                  if (notification.path) {
                                    navigate(notification.path);
                                  } else if (notification.relatedBorrowingId) {
                                    navigate(`/borrowings?search=${notification.relatedBorrowingId}`);
                                  }
                                  setNotificationOpen(false);
                                }}
                              >
                                <div className="flex items-start">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {notification.title}
                                    </p>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                      {notification.message}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                      {new Date(notification.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                  {!notification.isRead && (
                                    <div className="w-2 h-2 bg-primary-500 rounded-full ml-2 mt-1" />
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="p-4 border-t dark:border-gray-700">
                          <Link
                            to="/notifications"
                            className="block text-center text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            onClick={() => setNotificationOpen(false)}
                          >
                            View all notifications
                          </Link>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Logout - Hidden on desktop for Admin/Officer (moved to sidebar) */}
                <button
                  onClick={handleLogout}
                  className={`hidden sm:flex ${(isAdmin || isOfficer) ? 'lg:hidden' : ''} p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700`}
                  aria-label="Logout"
                >
                  <FiLogOut size={20} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full py-6 sm:py-8 px-4 sm:px-6 lg:px-12">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;  