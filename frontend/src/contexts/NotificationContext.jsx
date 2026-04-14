import React, { createContext, useState, useContext, useEffect } from 'react';
import { notificationsAPI } from '../api/notifications';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import toast from 'react-hot-toast';

// Inisialisasi Context untuk Notifikasi
const NotificationContext = createContext({});

// Hook kustom untuk mengakses NotificationContext
export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false); // Status loading untuk pengambilan data
  const { user, isAuthenticated } = useAuth();
  const socket = useSocket();

  // Ambil notifikasi saat user login
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, user?.id]);

  // Gunakan socket bersama untuk notifikasi real-time
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => {
      console.log('Notifikasi baru diterima di context:', data);
      const normalizedData = {
        ...data,
        id: data.id || data._id,
        _id: data._id || data.id
      };
      setNotifications(prev => [normalizedData, ...prev]);
      setUnreadCount(prev => prev + 1);
    };

    socket.on('notification', handleNotification);
    
    // Auto-fetch notifikasi terbaru setiap kali socket terhubung kembali
    socket.on('connect', () => {
      console.log('Socket terhubung kembali, sinkronisasi notifikasi...');
      fetchNotifications();
    });

    return () => {
      socket.off('notification', handleNotification);
      socket.off('connect');
    };
  }, [socket]);

  // Fungsi untuk mengambil seluruh notifikasi dari server
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const [notifs, count] = await Promise.all([
        notificationsAPI.getNotifications({ limit: 100 }),
        notificationsAPI.getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count.count);
    } catch (error) {
      console.error('Gagal mengambil notifikasi:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tandai notifikasi tertentu sebagai terbaca
  const markAsRead = async (id) => {
    try {
      await notificationsAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(notif =>
          (notif._id == id || notif.id == id) ? { ...notif, isRead: true } : notif
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Gagal menandai notifikasi terbaca:', error);
      toast.error('Gagal menandai terbaca');
    }
  };

  // Tandai semua notifikasi sebagai terbaca
  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev =>
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Gagal menandai semua terbaca:', error);
    } finally {
      setLoading(false);
    }
  };

  // Hapus notifikasi tertentu
  const deleteNotification = async (id) => {
    try {
      await notificationsAPI.deleteNotification(id);
      const notification = notifications.find(n => n._id == id || n.id == id);
      setNotifications(prev => prev.filter(notif => notif._id != id && notif.id != id));
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast.success('Notifikasi dihapus');
    } catch (error) {
      console.error('Gagal menghapus notifikasi:', error);
      toast.error('Gagal menghapus notifikasi');
    }
  };

  // Hapus semua notifikasi milik user
  const deleteAllNotifications = async () => {
    setLoading(true);
    try {
      await notificationsAPI.deleteAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
      toast.success('Semua notifikasi dihapus');
    } catch (error) {
      console.error('Gagal menghapus semua notifikasi:', error);
      toast.error('Gagal menghapus semua notifikasi');
    } finally {
      setLoading(false);
    }
  };

  // Tambahkan notifikasi secara manual ke state (opsional)
  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.isRead) {
      setUnreadCount(prev => prev + 1);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
        addNotification,
        refresh: fetchNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};