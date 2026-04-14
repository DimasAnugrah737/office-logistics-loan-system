import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { FiBell, FiCheck, FiTrash2, FiClock, FiAlertCircle, FiSettings, FiVolume2, FiVolumeX, FiCheckCircle, FiX, FiAlertTriangle, FiArrowLeft } from 'react-icons/fi';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import ConfirmationModal from '../components/ConfirmationModal';

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState(false);
  const [isDeleteOneModalOpen, setIsDeleteOneModalOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'read') return notification.isRead;
    return true;
  });

  const getNotificationIcon = (type) => {
    const map = {
      borrow_request: <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-none"><FiBell size={20} /></div>,
      borrow_approved: <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-none"><FiCheckCircle size={20} /></div>,
      borrow_rejected: <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-none"><FiTrash2 size={20} /></div>,
      overdue_warning: <div className="p-3 bg-rose-600 text-white rounded-none animate-pulse"><FiAlertCircle size={20} /></div>,
      system: <div className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-none"><FiSettings size={20} /></div>,
    };
    return map[type] || map.system;
  };

  const handleDeleteAll = () => {
    deleteAllNotifications();
    setIsDeleteAllModalOpen(false);
  };

  const handleDeleteOneClick = (n, e) => {
    e.preventDefault();
    e.stopPropagation();
    setNotificationToDelete(n);
    setIsDeleteOneModalOpen(true);
  };

  const confirmDeleteOne = () => {
    if (notificationToDelete) {
      deleteNotification(notificationToDelete._id || notificationToDelete.id);
      setIsDeleteOneModalOpen(false);
      setNotificationToDelete(null);
    }
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-start md:items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="mt-1 md:mt-0 p-3 bg-gray-100 dark:bg-gray-800 rounded-none text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            aria-label="Back"
            title="Back"
          >
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter relative -top-1">Notification Center</h1>
            <p className="text-sm text-gray-500 font-medium">Important updates regarding your borrowings.</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 w-full md:w-auto">
          <button
            onClick={markAllAsRead}
            title="Mark All as Read"
            className="flex items-center justify-center gap-2 p-4 md:px-6 md:py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-all shadow-sm flex-1 md:flex-none"
          >
            <FiCheck size={18} /> <span className="hidden md:inline">Mark All as Read</span>
          </button>
          <button
            onClick={() => setIsDeleteAllModalOpen(true)}
            title="Delete All"
            className="flex items-center justify-center gap-2 p-4 md:px-6 md:py-3 bg-rose-500 text-white rounded-none text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20 flex-1 md:flex-none"
          >
            <FiTrash2 size={18} /> <span className="hidden md:inline">Delete All</span>
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isDeleteAllModalOpen}
        onClose={() => setIsDeleteAllModalOpen(false)}
        onConfirm={handleDeleteAll}
        title="Delete All Notifications"
        message="Are you sure you want to delete all notifications? This action cannot be undone."
        confirmText="Delete All"
        type="danger"
        icon={FiTrash2}
      />

      <ConfirmationModal
        isOpen={isDeleteOneModalOpen}
        onClose={() => setIsDeleteOneModalOpen(false)}
        onConfirm={confirmDeleteOne}
        title="Delete Notification"
        message="Are you sure you want to delete this notification?"
        confirmText="Delete"
        type="danger"
        icon={FiTrash2}
      />

      <div className="flex items-center gap-3 p-1 bg-gray-100 dark:bg-gray-800 rounded-none w-fit">
        {['all', 'unread', 'read'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2.5 rounded-none text-[10px] font-black uppercase tracking-widest transition-all ${filter === f
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-md'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {f === 'all' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : 'Read'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-24 bg-gray-50 dark:bg-gray-800/30 rounded-none border-2 border-dashed border-gray-200 dark:border-gray-700">
            <FiBell size={60} className="mx-auto text-gray-300 mb-6" />
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Empty Inbox</h3>
            <p className="text-sm text-gray-500 mt-2">You will receive notifications if there are any borrowing status updates.</p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n._id || n.id}
              onClick={() => {
                markAsRead(n._id || n.id);
                if (n.path) navigate(n.path);
              }}
              className={`group relative bg-white dark:bg-gray-800 p-6 rounded-none border transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 ${!n.isRead
                ? 'border-theme-primary ring-2 ring-theme-primary/10 shadow-lg shadow-theme-primary/5'
                : 'border-gray-100 dark:border-gray-700 hover:border-theme-primary/50'
                }`}
            >
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className={`text-lg font-black tracking-tight ${!n.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                      {n.title}
                    </h4>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-900 px-3 py-1 rounded-none border border-gray-100 dark:border-gray-800">
                      {format(new Date(n.createdAt), 'dd MMM, HH:mm', { locale: enUS })}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${!n.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'}`}>
                    {n.message}
                  </p>
                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={(e) => handleDeleteOneClick(n, e)}
                      title="Delete Notification"
                      className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-rose-600 transition-colors flex items-center gap-1.5 p-2 -m-2 rounded-none hover:bg-rose-50 dark:hover:bg-rose-900/10 z-10 relative"
                    >
                      <FiTrash2 /> Delete Permanently
                    </button>
                    {!n.isRead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n._id || n.id); }}
                        className="text-[10px] font-black uppercase tracking-widest text-primary-600 flex items-center gap-1.5"
                      >
                        <FiCheck /> Mark as Read
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {!n.isRead && (
                <div className="absolute top-6 right-6 flex">
                  <span className="w-3 h-3 bg-primary-600 rounded-none animate-ping absolute opacity-75"></span>
                  <span className="w-3 h-3 bg-primary-600 rounded-none relative"></span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;