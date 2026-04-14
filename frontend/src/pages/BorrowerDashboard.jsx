import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { itemsAPI } from '../api/items';
import { categoriesAPI } from '../api/categories';
import { borrowingsAPI } from '../api/borrowings';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import {
  FiSearch,
  FiPackage,
  FiGrid,
  FiBox,
  FiArrowRight,
  FiFilter,
  FiInfo,
  FiCalendar,
  FiShield,
  FiTruck,
  FiClock,
  FiAlertCircle,
  FiHash,
  FiMapPin,
  FiList,
  FiX
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const BorrowerDashboard = () => {
  // --- Antarmuka & Navigasi ---
  const navigate = useNavigate();
  const { user } = useAuth(); // Data pengguna login
  const socket = useSocket(); // Koneksi real-time

  // --- State Data ---
  const [items, setItems] = useState([]); // Daftar barang murni dari API
  const [categories, setCategories] = useState([]); // Daftar kategori
  const [filteredItems, setFilteredItems] = useState([]); // Daftar barang setelah filter & pencarian

  // --- State Pencarian & Tampilan ---
  const [searchTerm, setSearchTerm] = useState(''); // Nilai input pencarian
  const [debouncedSearch, setDebouncedSearch] = useState(''); // Nilai pencarian tertunda (untuk optimasi API)
  const [selectedCategory, setSelectedCategory] = useState('all'); // Filter kategori
  const [viewLayout, setViewLayout] = useState('grid'); // Tata letak tampilan ('grid' atau 'list')
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false); // Toggle hanya tampilkan yang tersedia

  // --- Optimasi Pencarian: Debounce ---
  // Menunggu pengguna selesai mengetik selama 500ms sebelum memicu pencarian ke server
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // --- State Loading & Modal ---
  const [loading, setLoading] = useState(true); // Loading state global
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Loading pertama kali
  const [viewingItem, setViewingItem] = useState(null); // Barang yang sedang dilihat detailnya
  const [isViewModalOpen, setIsViewModalOpen] = useState(false); // Modal Detail
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false); // Modal Form Pinjam
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false); // Modal Konfirmasi Akhir

  // Data input untuk form peminjaman
  const [borrowData, setBorrowData] = useState({
    quantity: 1,
    borrowDate: '',
    expectedReturnDate: '',
    purpose: ''
  });

  // --- API Hooks ---
  const { execute: fetchItems } = useApi(itemsAPI.getAllItems);
  const { execute: fetchCategories } = useApi(categoriesAPI.getAllCategories);
  const { execute: createBorrowing } = useApi(borrowingsAPI.createBorrowing);

  // Trigger reload data saat parameter filter/pencarian berubah
  useEffect(() => {
    loadData(false); // Silent load (tanpa spinner besar) untuk filter
  }, [debouncedSearch, selectedCategory, showOnlyAvailable]);

  // Load data awal
  useEffect(() => {
    loadData(true); // Initial load dengan spinner
  }, []);

  /**
   * Listener WebSocket untuk sinkronisasi inventaris secara otomatis
   * jika ada perubahan dari admin/petugas lain.
   */
  useEffect(() => {
    if (!socket) return;
    const updateHandler = () => loadData();
    socket.on('item:updated', updateHandler);
    socket.on('item:created', updateHandler);
    socket.on('item:deleted', updateHandler);
    return () => {
      socket.off('item:updated', updateHandler);
      socket.off('item:created', updateHandler);
      socket.off('item:deleted', updateHandler);
    };
  }, [socket]);

  /**
   * Mengambil data dari server dengan filter yang aktif
   * @param {boolean} showSpinner - Apakah ingin menampilkan animasi loading utama
   */
  const loadData = async (showSpinner = false) => {
    if (showSpinner || isInitialLoading) {
      setLoading(true);
    }
    try {
      const [iData, cData] = await Promise.all([
        fetchItems({
          limit: 100,
          search: debouncedSearch,
          categoryId: selectedCategory !== 'all' ? selectedCategory : undefined
        }),
        fetchCategories()
      ]);

      let loadedItems = iData?.items || iData || [];

      // Filter ketersediaan di sisi client
      if (showOnlyAvailable) {
        loadedItems = loadedItems.filter(item => item.availableQuantity > 0);
      }

      setItems(loadedItems);
      setFilteredItems(loadedItems);
      setCategories(cData || []);
      setIsInitialLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Validasi awal sebelum mengirim permintaan peminjaman
   */
  const handleBorrow = (e) => {
    e.preventDefault();
    if (!viewingItem) return;

    if (borrowData.quantity > viewingItem.availableQuantity) {
      toast.error('Quantity exceeds available stock');
      return;
    }

    if (!borrowData.borrowDate) {
      toast.error('Borrow date is required');
      return;
    }

    if (!borrowData.expectedReturnDate) {
      toast.error('Return date is required');
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const borrowDate = new Date(borrowData.borrowDate);
    const returnDate = new Date(borrowData.expectedReturnDate);

    if (borrowDate < today) {
      toast.error('Borrow date cannot be in the past');
      return;
    }

    if (returnDate < borrowDate) {
      toast.error('Return date cannot be earlier than borrow date');
      return;
    }

    setIsSubmitModalOpen(true);
  };

  /**
   * Mengirim data peminjaman ke server API
   */
  const confirmBorrow = async () => {
    try {
      await createBorrowing({
        itemId: viewingItem.id,
        ...borrowData
      });

      toast.success('Borrowing request sent successfully');;

      // Reset semua modal dan form
      setIsSubmitModalOpen(false);
      setIsBorrowModalOpen(false);
      setIsViewModalOpen(false);
      setBorrowData({ quantity: 1, borrowDate: '', expectedReturnDate: '', purpose: '' });

      loadData(); // Refresh data untuk update stok terbaru
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    }
  };

  // Tampilan loading utama
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-12 pb-20">
      {/* Hero Section */}
      <section className="relative -mt-8 -mx-4 sm:-mx-6 lg:-mx-12 bg-gray-900 overflow-hidden min-h-[220px] sm:min-h-[400px] flex items-center pt-4 sm:pt-0">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-500 rounded-none mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-72 h-72 bg-indigo-500 rounded-none mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-none mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-12 text-center">
          <h1 className="text-xl sm:text-5xl lg:text-6xl font-black text-white mb-2 sm:mb-6 tracking-tight leading-tight uppercase">
            OFFICE <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-indigo-400">Equipment</span>
          </h1>
          <p className="text-[10px] sm:text-lg text-gray-400 mb-4 sm:mb-10 max-w-xl mx-auto font-medium px-4">
            Find the equipment you need to support your productivity today.
          </p>

          {/* Search Bar & Fast Nav */}
          <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
            <div className="relative group px-4 sm:px-0">
              <div className="absolute inset-y-0 left-4 sm:left-0 pl-3 sm:pl-6 flex items-center pointer-events-none">
                <FiSearch className="h-3 w-3 sm:h-6 sm:w-6 text-primary-500 group-focus-within:text-primary-400 transition-colors" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 sm:pl-16 pr-4 py-2.5 sm:py-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-none text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white/20 transition-all text-[10px] sm:text-lg font-medium shadow-2xl shadow-black/40"
                placeholder="Search equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const resultsSection = document.getElementById('inventory-section');
                    resultsSection?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              />
            </div>

            <div className="flex justify-center gap-3 sm:gap-4 px-4 sm:px-0">
              <button
                onClick={() => {
                  const itemsSec = document.getElementById('inventory-section');
                  itemsSec?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-none text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all border border-white/10"
              >
                Borrow
              </button>
              <Link
                to="/my-borrowings"
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 bg-theme-primary hover:bg-theme-primary text-white rounded-none text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-theme-primary/20 text-center"
              >
                History
              </Link>
            </div>
          </div>
        </div>
      </section>

      {user?.isBlockedFromBorrowing ? (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-none p-8 sm:p-16 text-center shadow-xl">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-red-100 dark:bg-red-900/30 rounded-none mb-6 sm:mb-8 text-red-600 dark:text-red-400">
            <FiAlertCircle size={48} className="animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-red-900 dark:text-red-300 uppercase tracking-tighter mb-4">
            Access Suspended
          </h2>
          <p className="text-sm sm:text-lg text-red-700 dark:text-red-400 font-medium max-w-2xl mx-auto leading-relaxed">
            {user.blockReason || 'You are not allowed to view the item list due to overdue borrowings. Please return the items first.'}
          </p>
          <Link
            to="/my-borrowings"
            className="inline-block mt-8 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-none font-black uppercase tracking-widest text-sm sm:text-base shadow-lg shadow-red-500/30 transition-all transform hover:scale-105"
          >
            View My Borrowings
          </Link>
        </div>
      ) : (
        <>
          {/* Categories Horizontal Scroll */}
          <section id="categories-section" className="mt-4 sm:mt-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-1 sm:gap-2">
              <h2 className="text-base sm:text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Popular Categories</h2>
              <button
                onClick={() => navigate('/browse-items')}
                className="text-[10px] sm:text-sm font-bold text-primary-600 dark:text-primary-400 flex items-center hover:translate-x-1 transition-transform w-fit"
              >
                See All <FiArrowRight className="ml-1" size={12} />
              </button>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto pb-2 sm:pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex-shrink-0 min-w-[80px] sm:min-w-[120px] px-4 py-2 sm:py-3.5 rounded-none font-black text-[9px] sm:text-xs tracking-widest transition-all border-2 uppercase ${selectedCategory === 'all'
                  ? 'bg-theme-primary text-white border-theme-primary shadow-lg shadow-theme-primary/20'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:border-theme-primary/50'
                  }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 min-w-[80px] sm:min-w-[120px] px-4 py-2 sm:py-3.5 rounded-none font-black text-[9px] sm:text-xs tracking-widest transition-all border-2 uppercase ${String(selectedCategory) === String(cat.id)
                    ? 'bg-theme-primary text-white border-theme-primary shadow-lg shadow-theme-primary/20'
                    : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:border-theme-primary/50'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </section>

          {/* Item Grid */}
          <section id="inventory-section">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Most Popular Equipment</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Showing top 4 most borrowed items</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowOnlyAvailable(!showOnlyAvailable)}
                  className={`flex items-center gap-2 px-3 py-2 border rounded-none transition-all shadow-sm group ${showOnlyAvailable
                    ? 'bg-theme-primary border-theme-primary text-white shadow-theme-primary/20'
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:text-theme-primary'}`}
                >
                  <FiFilter size={18} className={showOnlyAvailable ? 'animate-pulse' : ''} />
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    {showOnlyAvailable ? 'Available' : 'All'}
                  </span>
                </button>
                <button
                  onClick={() => setViewLayout(viewLayout === 'grid' ? 'list' : 'grid')}
                  className="p-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none text-gray-500 hover:text-primary-600 transition-all shadow-sm"
                  title={viewLayout === 'grid' ? "List View" : "Grid View"}
                >
                  {viewLayout === 'grid' ? <FiGrid size={20} /> : <FiList size={20} />}
                </button>
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/30 rounded-none border-2 border-dashed border-gray-200 dark:border-gray-700">
                <div className="inline-flex w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-none items-center justify-center text-gray-400 mb-4">
                  <FiSearch size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Items Found</h3>
                <p className="text-sm text-gray-500">Try using different search keywords or categories.</p>
              </div>
            ) : viewLayout === 'grid' ? (
              <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-6">
                {filteredItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { setViewingItem(item); setIsViewModalOpen(true); }}
                    className="group bg-white dark:bg-gray-800 rounded-none overflow-hidden border border-gray-100 dark:border-gray-700 hover:border-primary-500/50 hover:shadow-xl transition-all duration-500 cursor-pointer flex flex-col h-full shadow-sm"
                  >
                    {/* Image Area */}
                    <div className="relative h-28 sm:h-40 lg:h-48 overflow-hidden bg-gray-100 dark:bg-gray-900">
                      {item.image ? (
                        <img
                          src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${item.image}`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          alt={item.name}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 transform group-hover:scale-110 transition-transform duration-700">
                          <FiBox size={30} className="sm:hidden" />
                          <FiBox size={60} className="hidden sm:block" />
                        </div>
                      )}
                      {/* Status Badge */}
                      <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                        <span className={`px-2 py-1 sm:px-4 sm:py-1.5 rounded-none text-[7px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg ${item.availableQuantity > 0
                          ? 'bg-emerald-500 text-white'
                          : 'bg-red-500 text-white'
                          }`}>
                          {item.availableQuantity > 0 ? 'Available' : 'Out of Stock'}
                        </span>
                      </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-2 sm:p-4 flex-grow flex flex-col">
                      <div className="flex-grow">
                        <p className="text-[7px] sm:text-[10px] font-black text-theme-primary uppercase tracking-widest mb-1 sm:mb-2 line-clamp-1">
                          {item.category?.name || 'Category'}
                        </p>
                        <h3 className="text-xs sm:text-lg font-extrabold text-gray-900 dark:text-white mb-1 sm:mb-2 leading-tight group-hover:text-theme-primary transition-colors line-clamp-1 sm:line-clamp-2">
                          {item.name}
                        </h3>
                        <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 line-clamp-2 font-medium">
                          {item.description || 'No additional description for this item.'}
                        </p>
                      </div>

                      <div className="mt-2 sm:mt-6 pt-2 sm:pt-6 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
                        <div>
                          <p className="text-[7px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Stock</p>
                          <p className="text-xs sm:text-lg font-black text-gray-900 dark:text-white leading-none">
                            {item.availableQuantity} <span className="text-[8px] sm:text-xs font-bold text-gray-400">/ {item.quantity}</span>
                          </p>
                        </div>
                        <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-none bg-theme-primary-light flex items-center justify-center text-theme-primary group-hover:bg-theme-primary group-hover:text-white transition-all transform group-hover:rotate-45">
                          <FiArrowRight size={14} className="sm:hidden" />
                          <FiArrowRight size={20} className="hidden sm:block" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {filteredItems.slice(0, 4).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => { setViewingItem(item); setIsViewModalOpen(true); }}
                    className="group flex items-center bg-white dark:bg-gray-800 rounded-none p-3 sm:p-4 border border-gray-100 dark:border-gray-700 hover:border-primary-500/50 hover:shadow-xl transition-all cursor-pointer gap-3 sm:gap-6"
                  >
                    <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-none overflow-hidden bg-gray-100 dark:bg-gray-900 shrink-0">
                      {item.image ? (
                        <img src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${item.image}`} className="w-full h-full object-cover" alt={item.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300"><FiBox size={24} /></div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[7px] sm:text-[10px] font-black text-primary-600 uppercase tracking-widest truncate">{item.category?.name}</span>
                        <span className={`px-1.5 py-0.5 rounded-none text-[7px] sm:text-[8px] font-bold uppercase tracking-widest ${item.availableQuantity > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {item.availableQuantity > 0 ? 'Available' : 'Out of Stock'}
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors uppercase tracking-tight truncate">{item.name}</h3>
                      <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400 line-clamp-1 font-medium italic mt-1">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-8 pr-1 sm:pr-4">
                      <div className="text-center">
                        <p className="text-[7px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Stock</p>
                        <p className="text-sm sm:text-lg font-black text-gray-900 dark:text-white leading-none whitespace-nowrap">{item.availableQuantity} <span className="text-[8px] text-gray-400">/ {item.quantity}</span></p>
                      </div>
                      <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-none bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center text-gray-400 group-hover:bg-primary-600 group-hover:text-white transition-all shrink-0">
                        <FiArrowRight size={18} className="sm:hidden" />
                        <FiArrowRight size={24} className="hidden sm:block" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* How it Works / Perks */}
      <section className="bg-theme-primary-light rounded-none p-6 sm:p-12 border border-theme-primary/10">
        <div className="flex flex-row overflow-x-auto sm:grid sm:grid-cols-3 gap-6 sm:gap-12 scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
          <div className="flex flex-col items-center text-center min-w-[200px] sm:min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white dark:bg-gray-800 rounded-none flex items-center justify-center text-theme-primary shadow-lg mb-4 sm:mb-6 transform -rotate-6">
              <FiShield size={24} className="sm:size-[32px]" />
            </div>
            <h4 className="text-sm sm:text-lg font-black text-gray-900 dark:text-white mb-2 sm:mb-3 tracking-tighter uppercase">Asset Protection</h4>
            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">All equipment is in prime condition and security is guaranteed.</p>
          </div>
          <div className="flex flex-col items-center text-center min-w-[200px] sm:min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white dark:bg-gray-800 rounded-none flex items-center justify-center text-theme-primary shadow-lg mb-4 sm:mb-6">
              <FiTruck size={24} className="sm:size-[32px]" />
            </div>
            <h4 className="text-sm sm:text-lg font-black text-gray-900 dark:text-white mb-2 sm:mb-3 tracking-tighter uppercase">Fast Process</h4>
            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">Borrow today, get the tool instantly in minutes.</p>
          </div>
          <div className="flex flex-col items-center text-center min-w-[200px] sm:min-w-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white dark:bg-gray-800 rounded-none flex items-center justify-center text-theme-primary shadow-lg mb-4 sm:mb-6 transform rotate-6">
              <FiInfo size={24} className="sm:size-[32px]" />
            </div>
            <h4 className="text-sm sm:text-lg font-black text-gray-900 dark:text-white mb-2 sm:mb-3 tracking-tighter uppercase">Help Desk</h4>
            <p className="text-[10px] sm:text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">Contact the officer whenever you encounter issues with the equipment.</p>
          </div>
        </div>
      </section>

      {/* Item Detail & Borrow Modal */}
      {isViewModalOpen && viewingItem && (
        <div
          onClick={() => setIsViewModalOpen(false)}
          className="fixed inset-0 z-30 flex items-center justify-center p-2 pt-20 sm:p-4 sm:pt-24 bg-gray-900/90 backdrop-blur-lg animate-in fade-in duration-300 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 rounded-none w-[95%] sm:w-full max-w-4xl shadow-2xl border border-white/10 overflow-hidden relative my-2 sm:my-8"
          >
            <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-50">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 bg-black/50 text-white backdrop-blur-md rounded-none transition-all hover:bg-black/70 shadow-lg"
                title="Close (Esc)"
              >
                <FiX size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Image Side */}
              <div className="h-32 sm:h-72 lg:h-auto bg-gray-50 dark:bg-gray-800/50 relative p-3 sm:p-10 flex items-center justify-center border-b border-gray-100 dark:border-gray-800 lg:border-b-0">
                {viewingItem.image ? (
                  <img src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${viewingItem.image}`} className="max-w-[70%] max-h-full object-contain drop-shadow-xl" alt={viewingItem.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300"><FiBox size={50} className="sm:size-[100px]" /></div>
                )}
              </div>

              {/* Info Side */}
              <div className="p-5 sm:p-8 lg:p-12 space-y-4 sm:space-y-8 max-h-[70vh] sm:max-h-[85vh] overflow-y-auto">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4">
                    <span className="px-4 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-none text-[10px] font-black uppercase tracking-widest">
                      {viewingItem.category?.name || 'Category'}
                    </span>
                    {viewingItem.availableQuantity > 0 && (
                      <span className="px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-none text-[10px] font-black uppercase tracking-widest">
                        Ready to Use
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm sm:text-3xl font-black text-gray-900 dark:text-white tracking-wider mb-2 sm:mb-4 leading-tight uppercase">
                    {viewingItem.name}
                  </h2>
                  <div className="flex flex-wrap gap-4 sm:gap-6 text-[10px] sm:text-sm">
                    <div className="flex items-center gap-1.5">
                      <FiHash className="text-primary-600 shrink-0" />
                      <span className="text-gray-500 whitespace-nowrap">Serial:</span>
                      <span className="font-bold text-gray-900 dark:text-white uppercase tracking-tighter truncate max-w-[100px]">{viewingItem.serialNumber || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FiMapPin className="text-primary-600 shrink-0" />
                      <span className="text-gray-500 whitespace-nowrap">Location:</span>
                      <span className="font-bold text-gray-900 dark:text-white uppercase tracking-tighter truncate max-w-[100px]">{viewingItem.location || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 sm:space-y-3">
                  <h4 className="text-[8px] sm:text-sm font-black text-gray-400 uppercase tracking-widest">Item Information</h4>
                  <div className="p-2 sm:p-6 bg-gray-50 dark:bg-gray-800/50 rounded-none border border-gray-100 dark:border-gray-700 text-[9px] sm:text-base text-gray-600 dark:text-gray-400 font-medium leading-relaxed italic max-h-[100px] sm:max-h-none overflow-y-auto">
                    {viewingItem.description || 'Item in ' + viewingItem.condition + ' condition.'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="p-2 sm:p-4 bg-theme-primary-light rounded-none border border-theme-primary/10 text-center">
                    <p className="text-[7px] sm:text-[10px] font-black text-theme-primary opacity-60 uppercase tracking-widest mb-0.5">Available</p>
                    <p className="text-base sm:text-2xl font-black text-theme-primary tracking-tighter">{viewingItem.availableQuantity}</p>
                  </div>
                  <div className="p-2 sm:p-4 bg-gray-50 dark:bg-gray-800/50 rounded-none border border-gray-100 dark:border-gray-700 text-center">
                    <p className="text-[7px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total</p>
                    <p className="text-base sm:text-2xl font-black text-gray-900 dark:text-white tracking-tighter">{viewingItem.quantity}</p>
                  </div>
                </div>

                {/* Original Desktop Buttons (Hidden on Mobile) */}
                <div className="hidden lg:flex gap-4 pt-6">
                  <button
                    disabled={viewingItem.availableQuantity <= 0}
                    onClick={() => setIsBorrowModalOpen(true)}
                    className="flex-1 py-4 bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-none font-black uppercase tracking-widest text-sm shadow-xl shadow-primary-500/30 hover:bg-primary-700 transition-all transform active:scale-95"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            </div>

            {/* Sticky Footer for Action Buttons */}
            <div className="sticky bottom-0 left-0 right-0 p-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 flex gap-2 z-30 lg:hidden">
              <button
                disabled={viewingItem.availableQuantity <= 0}
                onClick={() => setIsBorrowModalOpen(true)}
                className="flex-[2] py-3 bg-theme-primary disabled:bg-gray-300 text-white rounded-none font-black uppercase tracking-widest text-[9px] shadow-lg shadow-theme-primary/20"
              >
                Send Request
              </button>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-none font-black uppercase tracking-widest text-[9px] border border-gray-200 dark:border-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Borrow Form Modal */}
      {isBorrowModalOpen && viewingItem && (
        <div className="fixed inset-0 z-[35] flex items-center justify-center p-2 pt-20 sm:p-4 sm:pt-24 bg-gray-900/95 backdrop-blur-xl animate-in zoom-in duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-none w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden scrollbar-thin shadow-2xl border border-white/10 p-5 sm:p-7 relative mt-4">
            <button
              onClick={() => setIsBorrowModalOpen(false)}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <FiX size={24} />
            </button>

            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex w-12 h-12 sm:w-16 sm:h-16 bg-primary-50 dark:bg-primary-900/30 rounded-none items-center justify-center text-primary-600 mb-3 sm:mb-4">
                <FiCalendar className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tighter uppercase mb-1 sm:mb-2">Confirm Borrowing</h3>
              <p className="text-[10px] sm:text-sm text-gray-500 font-medium px-2">Complete the following data to process your request.</p>
            </div>

            <form onSubmit={handleBorrow} className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Borrow Quantity</label>
                <div className="relative">
                  <FiHash className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                  <input
                    type="number"
                    min="1"
                    max={viewingItem.availableQuantity}
                    required
                    value={borrowData.quantity}
                    onChange={(e) => setBorrowData({ ...borrowData, quantity: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none outline-none font-bold focus:border-primary-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Borrow Date</label>
                <div className="relative">
                  <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                  <input
                    type="date"
                    required
                    min={new Date().toLocaleDateString('en-CA')}
                    value={borrowData.borrowDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setBorrowData(prev => {
                        const updated = { ...prev, borrowDate: newDate };
                        if (prev.expectedReturnDate && prev.expectedReturnDate < newDate) {
                          updated.expectedReturnDate = newDate;
                        }
                        return updated;
                      });
                    }}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none outline-none font-bold focus:border-primary-500 transition-all [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Return Date</label>
                <div className="relative">
                  <FiClock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                  <input
                    type="date"
                    required
                    min={borrowData.borrowDate || new Date().toLocaleDateString('en-CA')}
                    value={borrowData.expectedReturnDate}
                    onChange={(e) => setBorrowData({ ...borrowData, expectedReturnDate: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none outline-none font-bold focus:border-primary-500 transition-all [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Purpose of Use</label>
                <textarea
                  required
                  placeholder="Tell us why you need this equipment..."
                  value={borrowData.purpose}
                  onChange={(e) => setBorrowData({ ...borrowData, purpose: e.target.value })}
                  className="w-full p-6 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none outline-none font-medium text-sm min-h-[120px] focus:border-primary-500 transition-all"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsBorrowModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase tracking-widest text-xs rounded-none transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-4 bg-theme-primary text-white font-black uppercase tracking-widest text-xs rounded-none shadow-lg shadow-theme-primary/20 hover:bg-theme-primary transition-all transform active:scale-95"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={confirmBorrow}
        title="Final Confirmation"
        message={`Are you sure you want to borrow ${borrowData.quantity} units of ${viewingItem?.name}?`}
        confirmText="Yes, Submit"
        type="primary"
        icon={FiPackage}
      />
    </div>
  );
};

export default BorrowerDashboard;
