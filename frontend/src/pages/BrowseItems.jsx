import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsAPI } from '../api/items';
import { categoriesAPI } from '../api/categories';
import { borrowingsAPI } from '../api/borrowings';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { FiSearch, FiPackage, FiCalendar, FiInfo, FiGrid, FiList, FiArrowRight, FiTag, FiArrowLeft, FiX, FiClock, FiHash } from 'react-icons/fi';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const BrowseItems = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('available');
  const [viewMode, setViewMode] = useState('grid'); // New state for view mode
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [borrowForm, setBorrowForm] = useState({
    quantity: 1,
    borrowDate: '',
    expectedReturnDate: '',
    purpose: '',
  });

  const { execute: fetchItems, loading } = useApi(itemsAPI.getAllItems);
  const { execute: fetchCategories } = useApi(categoriesAPI.getAllCategories);
  const { execute: createBorrowing } = useApi(borrowingsAPI.createBorrowing);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterItems();
  }, [items, searchTerm, selectedCategory, availabilityFilter]);

  const loadData = async () => {
    try {
      const [data, categoriesData] = await Promise.all([
        fetchItems({}), // Ambil semua barang (tersedia & habis stok)
        fetchCategories(),
      ]);

      if (data && data.items) {
        setItems(data.items);
      } else if (Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }

      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const filterItems = () => {
    let filtered = [...items];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.description?.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => {
        const itemCategoryId = typeof item.category === 'object' ? item.category.id : item.categoryId;
        return String(itemCategoryId) === String(selectedCategory);
      });
    }

    if (availabilityFilter !== 'all') {
      if (availabilityFilter === 'available') {
        filtered = filtered.filter((item) => item.availableQuantity > 0 && item.isAvailable);
      } else if (availabilityFilter === 'borrowed') {
        filtered = filtered.filter((item) => item.availableQuantity < item.quantity);
      } else if (availabilityFilter === 'maintenance') {
        filtered = filtered.filter((item) => item.condition === 'broken' || !item.isAvailable);
      } else if (availabilityFilter === 'unavailable') {
        filtered = filtered.filter((item) => item.availableQuantity === 0 || !item.isAvailable);
      }
    }

    setFilteredItems(filtered);
  };

  const handleBorrowClick = (item) => {
    if (user?.isBlockedFromBorrowing) {
      toast.error(`Borrowing suspended: ${user.blockReason || 'Please return overdue items first.'}`);
      return;
    }

    if (!item.isAvailable || item.availableQuantity === 0) {
      toast.error('This item is not available for borrowing');
      return;
    }

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    setSelectedItem(item);
    setBorrowForm({
      quantity: 1,
      borrowDate: todayStr,
      expectedReturnDate: todayStr,
      purpose: '',
    });
    setIsBorrowModalOpen(true);
  };

  const handleBorrowSubmit = (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (borrowForm.quantity < 1) {
      toast.error('Minimum quantity is 1 unit');
      return;
    }

    if (borrowForm.quantity > selectedItem.availableQuantity) {
      toast.error(`Only ${selectedItem.availableQuantity} units available in stock`);
      return;
    }

    if (!borrowForm.borrowDate) {
      toast.error('Borrow date is required');
      return;
    }

    if (!borrowForm.expectedReturnDate) {
      toast.error('Return date is required');
      return;
    }

    const borrowDate = new Date(borrowForm.borrowDate);
    const returnDate = new Date(borrowForm.expectedReturnDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (borrowDate < today) {
      toast.error('Borrow date cannot be in the past');
      return;
    }

    if (returnDate < borrowDate) {
      toast.error('Return date cannot be earlier than borrow date');
      return;
    }

    if (!borrowForm.purpose.trim()) {
      toast.error('Borrowing purpose is required');
      return;
    }

    setIsSubmitModalOpen(true);
  };

  const confirmBorrow = async () => {
    const borrowDate = new Date(borrowForm.borrowDate);
    const returnDate = new Date(borrowForm.expectedReturnDate);
    try {
      await createBorrowing({
        itemId: selectedItem.id,
        quantity: borrowForm.quantity,
        borrowDate: borrowDate.toISOString(),
        expectedReturnDate: returnDate.toISOString(),
        purpose: borrowForm.purpose,
      });

      toast.success('Borrowing request sent successfully');
      setIsBorrowModalOpen(false);
      setIsSubmitModalOpen(false);
      setSelectedItem(null);
      setBorrowForm({
        quantity: 1,
        borrowDate: '',
        expectedReturnDate: '',
        purpose: '',
      });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send request');
    }
  };

  const handleReadDescription = (item) => {
    setViewingItem(item);
    setIsDescriptionModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-none shadow-sm border border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Browse Items</h1>
            <p className="text-sm text-gray-500 font-medium">Find office equipment available for you to borrow.</p>
          </div>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-none shadow-sm border border-gray-100 dark:border-slate-700/50">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2.5 rounded-none transition-all ${viewMode === 'grid' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FiGrid size={18} />
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2.5 rounded-none transition-all ${viewMode === 'list' ? 'bg-theme-primary text-white shadow-lg shadow-theme-primary/20' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <FiList size={18} />
          </button>
        </div>
      </div>

      {user?.isBlockedFromBorrowing ? (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-none p-8 sm:p-16 text-center shadow-xl mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-red-100 dark:bg-red-900/30 rounded-none mb-6 sm:mb-8 text-red-600 dark:text-red-400">
            <FiInfo size={48} className="animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-red-900 dark:text-red-300 uppercase tracking-tighter mb-4">Access Suspended</h2>
          <p className="text-sm sm:text-lg text-red-700 dark:text-red-400 font-medium max-w-2xl mx-auto leading-relaxed">
            {user.blockReason || 'You are not allowed to view the item list due to overdue borrowings.'}
          </p>
        </div>
      ) : (
        <>
          {/* Filters Section - Responsive for mobile */}
          <div className="bg-white dark:bg-[#1e293b] rounded-none shadow-sm border border-gray-100 dark:border-slate-800 p-4 sm:p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center">
              {/* Kolom Pencarian */}
              <div className="md:col-span-12 lg:col-span-6 relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search equipment..."
                  className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 focus:border-theme-primary dark:focus:border-theme-primary/50 rounded-none outline-none text-sm font-medium transition-all"
                />
              </div>

              {/* Kolom Dropdown Kategori & Status */}
              <div className="md:col-span-12 lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="relative">
                  <FiTag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full pl-12 pr-10 py-3.5 sm:py-4 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-[10px] font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-600 dark:text-gray-400"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <FiPackage className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <select
                    value={availabilityFilter}
                    onChange={(e) => setAvailabilityFilter(e.target.value)}
                    className="w-full pl-12 pr-10 py-3.5 sm:py-4 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-[10px] font-black uppercase tracking-widest appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-600 dark:text-gray-400"
                  >
                    <option value="available">Available Only</option>
                    <option value="all">All Status</option>
                    <option value="unavailable">Out of Stock</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Items Display */}
          {loading ? (
            <div className={`grid ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4 sm:gap-6`}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-gray-100 dark:bg-gray-800 h-48 sm:h-64 rounded-none animate-pulse" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-none border border-dashed border-gray-200 dark:border-gray-700">
              <FiPackage size={60} className="mx-auto text-gray-200 mb-6" />
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">No items found</h3>
              <p className="text-sm text-gray-500 mt-2">Try adjusting your filter or search.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 pb-24 sm:pb-0">
              {filteredItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => handleBorrowClick(item)}
                  className="group bg-white dark:bg-gray-800 rounded-none p-3 sm:p-4 shadow-sm border border-gray-100 dark:border-gray-700/50 hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 flex flex-col cursor-pointer"
                >
                  <div className="relative h-32 sm:h-56 overflow-hidden rounded-none mb-3 sm:mb-6">
                    {item.image ? (
                      <img
                        className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                        src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${item.image}`}
                        alt={item.name}
                        onError={(e) => { e.target.parentElement.innerHTML = '<div class="absolute inset-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><svg class="h-8 w-8 text-gray-300" ... /></div>'; }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-300">
                        <FiPackage size={24} className="sm:hidden" />
                        <FiPackage size={48} className="hidden sm:block" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 sm:top-4 sm:left-4">
                      <span className={`px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-none text-[7px] sm:text-[10px] font-black uppercase tracking-widest ${item.availableQuantity > 0 ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-red-500 text-white'}`}>
                        {item.availableQuantity > 0 ? 'Available' : 'Out of Stock'}
                      </span>
                    </div>
                  </div>

                  <div className="px-1 sm:px-2 pb-1 sm:pb-2 flex-grow flex flex-col">
                    <p className="text-[7px] sm:text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1 sm:mb-2 opacity-80">
                      {typeof item.category === 'object' ? item.category.name : 'Uncategorized'}
                    </p>
                    <h3 className="text-xs sm:text-xl font-black text-gray-900 dark:text-white tracking-tight mb-2 sm:mb-4 group-hover:text-primary-600 transition-colors line-clamp-1 sm:line-clamp-2">
                      {item.name}
                    </h3>
                    
                    <div className="mt-auto pt-3 sm:pt-6 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between">
                      <div>
                        <p className="text-[7px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1 leading-none">Stock</p>
                        <p className="text-sm sm:text-lg font-black text-gray-900 dark:text-white">
                          {item.availableQuantity} <span className="text-gray-400 text-[10px] sm:text-sm">/ {item.quantity}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleBorrowClick(item)}
                        disabled={item.availableQuantity === 0}
                        className="w-8 h-8 sm:w-12 sm:h-12 flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-primary-600 rounded-none hover:bg-primary-600 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <FiArrowRight size={14} className="sm:hidden" />
                        <FiArrowRight size={20} className="hidden sm:block" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View Layout - Table mode similar to Dashboard */
            <div className="bg-white dark:bg-slate-800 rounded-none shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden pb-24 sm:pb-0">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/30 dark:bg-slate-800/50 border-b border-gray-100 dark:border-gray-700/50">
                    <th className="px-10 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Item</th>
                    <th className="px-10 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Category</th>
                    <th className="px-10 py-5 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Stock</th>
                    <th className="px-10 py-5 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {filteredItems.map((item) => (
                    <tr 
                      key={item.id} 
                      onClick={() => handleBorrowClick(item)}
                      className="hover:bg-gray-50/80 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer"
                    >
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-16 flex-shrink-0 relative overflow-hidden rounded-none bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
                            {item.image ? (
                              <img
                                className="absolute inset-0 h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${item.image}`}
                                alt={item.name}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-200"><FiPackage size={20} /></div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800 dark:text-white uppercase leading-tight">{item.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-wider">SN: {item.serialNumber || 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase tracking-widest">
                          {typeof item.category === 'object' ? item.category.name : 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <div className="flex flex-col items-center">
                          <p className={`text-sm font-black ${item.availableQuantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.availableQuantity}
                          </p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Available</p>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleBorrowClick(item); }}
                             disabled={item.availableQuantity === 0}
                             className="px-6 py-2 bg-theme-primary text-white rounded-none text-[10px] font-black uppercase tracking-widest hover:bg-primary-600 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale whitespace-nowrap shadow-lg shadow-theme-primary/10"
                          >
                            Borrow
                          </button>
                          <button 
                             onClick={(e) => { e.stopPropagation(); handleReadDescription(item); }}
                             className="p-2.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-none transition-all"
                          >
                            <FiInfo size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick Stats Overlay for Mobile - Compact for small screens */}
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900/90 dark:bg-slate-800/90 backdrop-blur-md px-6 py-3 rounded-none shadow-2xl border border-white/10 flex gap-5 z-20 sm:hidden">
              <div className="text-center">
                  <p className="text-[7px] font-black text-gray-400 uppercase tracking-tight mb-1">Total</p>
                  <p className="text-xs font-black text-white">{items.length}</p>
              </div>
              <div className="text-center border-x border-white/5 px-5">
                  <p className="text-[7px] font-black text-gray-400 uppercase tracking-tight mb-1">Available</p>
                  <p className="text-xs font-black text-emerald-400">{items.filter(i => i.availableQuantity > 0).length}</p>
              </div>
              <div className="text-center">
                  <p className="text-[7px] font-black text-gray-400 uppercase tracking-tight mb-1">Category</p>
                  <p className="text-xs font-black text-blue-400">{categories.length}</p>
              </div>
          </div>
        </>
      )}

      {/* Borrow Modal (Unified Style) */}
      {isBorrowModalOpen && selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 pt-20 sm:p-4 sm:pt-24 bg-gray-900/95 backdrop-blur-xl animate-in zoom-in duration-300">
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

            <form onSubmit={handleBorrowSubmit} className="space-y-6 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Borrow Quantity</label>
                <div className="relative">
                  <FiHash className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                  <input
                    type="number"
                    min="1"
                    max={selectedItem.availableQuantity}
                    required
                    value={borrowForm.quantity}
                    onChange={(e) => setBorrowForm({ ...borrowForm, quantity: parseInt(e.target.value) || 1 })}
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
                    value={borrowForm.borrowDate}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setBorrowForm(prev => {
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
                    min={borrowForm.borrowDate || new Date().toLocaleDateString('en-CA')}
                    value={borrowForm.expectedReturnDate}
                    onChange={(e) => setBorrowForm({ ...borrowForm, expectedReturnDate: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none outline-none font-bold focus:border-primary-500 transition-all [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Purpose of Use</label>
                <textarea
                  required
                  placeholder="Tell us why you need this equipment..."
                  value={borrowForm.purpose}
                  onChange={(e) => setBorrowForm({ ...borrowForm, purpose: e.target.value })}
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

      {/* Description Modal */}
      {isDescriptionModalOpen && viewingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-none w-full max-w-md p-8 shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-none">
                    <FiInfo size={32} />
                </div>
                <div>
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Detail Information</p>
                   <h3 className="text-xl font-black text-gray-900 dark:text-white leading-none uppercase">{viewingItem.name}</h3>
                </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900 rounded-none mb-8 border border-gray-100 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  {viewingItem.description || 'No description available for this item.'}
                </p>
            </div>

            <button
                onClick={() => setIsDescriptionModalOpen(false)}
                className="w-full py-4 bg-theme-primary text-white rounded-none text-[10px] font-black uppercase tracking-widest shadow-lg shadow-theme-primary/20 hover:shadow-xl transition-all active:scale-95"
            >
                Close
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={confirmBorrow}
        title="Final Confirmation"
        message={`Are you sure you want to borrow ${borrowForm.quantity} units of ${selectedItem?.name}?`}
        confirmText="Yes, Submit"
        type="primary"
        icon={FiPackage}
      />
    </div>
  );
};

export default BrowseItems;