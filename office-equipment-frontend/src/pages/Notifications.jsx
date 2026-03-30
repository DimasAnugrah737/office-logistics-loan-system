import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { FiBell, FiCheck, FiTrash2, FiClock, FiAlertCircle, FiSettings, FiVolume2, FiVolumeX, FiCheckCircle } from 'react-icons/fi';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [filter, setFilter] = useState('all');

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'read') return notification.isRead;
    return true;
  });

  const getNotificationIcon = (type) => {
    const map = {
      borrow_request: <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl"><FiBell size={20}/></div>,
      borrow_approved: <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl"><FiCheckCircle size={20}/></div>,
      borrow_rejected: <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-2xl"><FiTrash2 size={20}/></div>,
      overdue_warning: <div className="p-3 bg-rose-600 text-white rounded-2xl animate-pulse"><FiAlertCircle size={20}/></div>,
      system: <div className="p-3 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-2xl"><FiSettings size={20}/></div>,
    };
    return map[type] || map.system;
  };

  return (
    <div className="space-y-10 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Pusat Notifikasi</h1>
          <p className="text-sm text-gray-500 font-medium">Jangan lewatkan pembaruan penting mengenai peminjaman Anda.</p>
        </div>
        <button
          onClick={markAllAsRead}
          className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-all shadow-sm"
        >
          <FiCheck /> Tandai Semua Terbaca
        </button>
      </div>

      <div className="flex items-center gap-3 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
        {['all', 'unread', 'read'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f
              ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-md'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {f === 'all' ? 'Semua' : f === 'unread' ? `Belum Terbaca (${unreadCount})` : 'Riwayat'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-24 bg-gray-50 dark:bg-gray-800/30 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-700">
            <FiBell size={60} className="mx-auto text-gray-300 mb-6" />
            <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Kotak Masuk Kosong</h3>
            <p className="text-sm text-gray-500 mt-2">Anda akan menerima notifikasi jika ada pembaruan status peminjaman.</p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n._id || n.id}
              onClick={() => {
                markAsRead(n._id || n.id);
                if (n.path) navigate(n.path);
              }}
              className={`group relative bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border transition-all duration-300 cursor-pointer hover:shadow-xl hover:-translate-y-1 ${!n.isRead
                ? 'border-primary-500 ring-2 ring-primary-500/10 shadow-lg shadow-primary-500/5'
                : 'border-gray-100 dark:border-gray-700 hover:border-primary-500/50'
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
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 dark:bg-gray-900 px-3 py-1 rounded-full border border-gray-100 dark:border-gray-800">
                      {format(new Date(n.createdAt), 'dd MMM, HH:mm', { locale: id })}
                    </span>
                  </div>
                  <p className={`text-sm leading-relaxed ${!n.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-gray-500'}`}>
                    {n.message}
                  </p>
                  <div className="mt-4 flex gap-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n._id || n.id); }}
                      className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-rose-600 transition-colors flex items-center gap-1.5"
                    >
                      <FiTrash2 /> Hapus Permanen
                    </button>
                    {!n.isRead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markAsRead(n._id || n.id); }}
                        className="text-[10px] font-black uppercase tracking-widest text-primary-600 flex items-center gap-1.5"
                      >
                        <FiCheck /> Tandai Terbaca
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {!n.isRead && (
                 <div className="absolute top-6 right-6 flex">
                    <span className="w-3 h-3 bg-primary-600 rounded-full animate-ping absolute opacity-75"></span>
                    <span className="w-3 h-3 bg-primary-600 rounded-full relative"></span>
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