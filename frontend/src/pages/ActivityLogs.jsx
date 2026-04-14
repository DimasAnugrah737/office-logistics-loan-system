import React, { useState, useEffect, useCallback } from 'react';
import { reportsAPI } from '../api/reports';
import { useApi } from '../hooks/useApi';
import { useSocket } from '../contexts/SocketContext';
import {
  FiSearch,
  FiFilter,
  FiClock,
  FiUser,
  FiActivity,
  FiDownload,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiTrash2,
  FiFileText
} from 'react-icons/fi';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const ActivityLogs = () => {
  const socket = useSocket();
  const [logs, setLogs] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(false);


  const { execute: fetchLogs } = useApi(reportsAPI.getActivityLogs);


  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const logsData = await fetchLogs({
        page: currentPage,
        limit: 20,
        search: searchName,
        action: actionFilter,
        startDate: dateRange.from,
        endDate: dateRange.to
      });
      setLogs(logsData.logs || []);
      setTotalPages(logsData.pages || 1);
      setTotalLogs(logsData.total || 0);
    } catch (error) { } finally { setLoading(false); }
  }, [currentPage, searchName, actionFilter, dateRange, fetchLogs]);



  useEffect(() => {
    if (!socket) return;
    socket.on('activity:created', (newLog) => {
      setLogs(prev => [newLog, ...prev].slice(0, 20));
      setTotalLogs(prev => prev + 1);
    });
    return () => socket.off('activity:created');
  }, [socket]);

  useEffect(() => {
    const timer = setTimeout(() => loadLogs(), 500);
    return () => clearTimeout(timer);
  }, [currentPage, searchName, actionFilter, dateRange, loadLogs]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 tracking-tight">
            <FiActivity className="text-theme-primary" /> Activity Logs
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Monitor and track all system activities</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="meta-label">Total: <span className="font-bold">{totalLogs}</span></span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-none shadow-xl shadow-gray-200/10 dark:shadow-none border border-gray-100 dark:border-slate-800 p-2 sm:p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {/* Search Input */}
          <div className="relative group rounded-none border border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 focus-within:border-theme-primary/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-theme-primary/5 transition-all duration-300">
            <label className="text-[8px] font-black text-theme-primary uppercase tracking-[0.2em] absolute top-2.5 left-11 z-10 group-focus-within:text-theme-primary">Search</label>
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary h-4.5 w-4.5" />
            <input
              type="text"
              placeholder="User..."
              value={searchName}
              onChange={(e) => { setSearchName(e.target.value); setCurrentPage(1); }}
              className="w-full pl-11 pr-4 pt-6 pb-2.5 bg-transparent outline-none text-[11px] font-bold dark:text-white placeholder-gray-300"
            />
          </div>

          {/* Action Filter */}
          <div className="relative group rounded-none border border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 focus-within:border-theme-primary/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-theme-primary/5 transition-all duration-300">
            <label className="text-[8px] font-black text-theme-primary uppercase tracking-[0.2em] absolute top-2.5 left-11 z-10 group-focus-within:text-theme-primary">Action</label>
            <FiFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary h-4.5 w-4.5" />
            <select 
              value={actionFilter} 
              onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }} 
              className="w-full pl-11 pr-4 pt-6 pb-2.5 bg-transparent outline-none text-[11px] font-bold uppercase tracking-wider appearance-none dark:text-white cursor-pointer"
            >
              <option value="">All</option>
              <option value="login">Login</option>
              <option value="create">Created</option>
              <option value="update">Updated</option>
              <option value="delete">Deleted</option>
            </select>
          </div>

          {/* Date From */}
          <div className="relative group rounded-none border border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 focus-within:border-theme-primary/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-theme-primary/5 transition-all duration-300">
            <label className="text-[8px] font-black text-theme-primary uppercase tracking-[0.2em] absolute top-2.5 left-11 z-10 group-focus-within:text-theme-primary">From</label>
            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary h-4.5 w-4.5" />
            <input 
              type="date" 
              value={dateRange.from} 
              onChange={(e) => { setDateRange(p => ({ ...p, from: e.target.value })); setCurrentPage(1); }} 
              className="w-full pl-11 pr-4 pt-6 pb-2.5 bg-transparent outline-none text-[11px] font-bold dark:text-white cursor-pointer" 
            />
          </div>

          {/* Date To */}
          <div className="relative group rounded-none border border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 focus-within:border-theme-primary/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-theme-primary/5 transition-all duration-300">
            <label className="text-[8px] font-black text-theme-primary uppercase tracking-[0.2em] absolute top-2.5 left-11 z-10 group-focus-within:text-theme-primary">To</label>
            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary h-4.5 w-4.5" />
            <input 
              type="date" 
              value={dateRange.to} 
              onChange={(e) => { setDateRange(p => ({ ...p, to: e.target.value })); setCurrentPage(1); }} 
              className="w-full pl-11 pr-4 pt-6 pb-2.5 bg-transparent outline-none text-[11px] font-bold dark:text-white cursor-pointer" 
            />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-slate-800">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-col lg:flex-row lg:items-center gap-4 px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-all">
              <div className="flex items-center gap-2 min-w-[170px] text-xs text-gray-400 font-bold tracking-tighter tabular-nums">
                <FiClock className="text-theme-primary" /> {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm')}
              </div>
              <div className="flex items-center gap-3 min-w-[200px]">
                <div className="w-8 h-8 rounded-none bg-theme-primary-light flex items-center justify-center text-theme-primary font-bold text-[10px] border border-theme-primary/10">{log.user?.fullName?.charAt(0) || 'S'}</div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{log.user?.fullName || 'System'}</span>
                  <span className="text-[10px] font-bold text-gray-400">{log.user?.nip || 'AUTO'}</span>
                </div>
              </div>
              <div className="flex-grow text-sm font-medium text-gray-700 dark:text-gray-300">{log.action}</div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded-none text-[9px] font-black uppercase tracking-widest bg-gray-100 dark:bg-slate-800 text-gray-600">{log.entityType || 'SYS'}</span>
                <code className="text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-slate-900/50 px-2 py-1 rounded-none border border-gray-100 dark:border-slate-800">{log.ipAddress || '127.0.0.1'}</code>
              </div>
            </div>
          ))}
        </div>
      </div>


    </div>
  );
};

export default ActivityLogs;
