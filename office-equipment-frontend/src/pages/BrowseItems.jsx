import React, { useState, useEffect } from 'react';
import { itemsAPI } from '../api/items';
import { categoriesAPI } from '../api/categories';
import { borrowingsAPI } from '../api/borrowings';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { FiSearch, FiPackage, FiCalendar, FiInfo, FiGrid } from 'react-icons/fi';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const BrowseItems = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('available');
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDescriptionModalOpen, setIsDescriptionModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);
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
        fetchItems({ available: true }),
        fetchCategories(),
      ]);

      // Handle both old array format and new paginated object format for items
      if (data && data.items) {
        setItems(data.items);
      } else if (Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }

      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load data:', error);
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

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((item) => {
        const itemCategoryId = typeof item.category === 'object' ? item.category.id : item.categoryId;
        return String(itemCategoryId) === String(selectedCategory);
      });
    }

    // Availability filter
    if (availabilityFilter !== 'all') {
      if (availabilityFilter === 'available') {
        filtered = filtered.filter((item) => item.availableQuantity > 0 && item.isAvailable);
      } else if (availabilityFilter === 'borrowed') {
        filtered = filtered.filter((item) => item.availableQuantity < item.quantity);
      } else if (availabilityFilter === 'maintenance') {
        filtered = filtered.filter((item) => item.condition === 'broken' || !item.isAvailable);
      }
    }

    setFilteredItems(filtered);
  };

  const handleBorrowClick = (item) => {
    if (user?.isBlockedFromBorrowing) {
      toast.error(`Peminjaman ditangguhkan: ${user.blockReason || 'Silakan kembalikan barang yang terlambat terlebih dahulu.'}`);
      return;
    }

    if (!item.isAvailable || item.availableQuantity === 0) {
      toast.error('This item is not available for borrowing');
      return;
    }

    // Set minimum return date (today)
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

  const handleBorrowSubmit = async (e) => {
    e.preventDefault();

    if (!selectedItem) return;

    // Validate form
    if (borrowForm.quantity < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }

    if (borrowForm.quantity > selectedItem.availableQuantity) {
      toast.error(`Only ${selectedItem.availableQuantity} items available`);
      return;
    }

    if (!borrowForm.expectedReturnDate) {
      toast.error('Please select a return date');
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
      toast.error('Please provide a purpose for borrowing');
      return;
    }

    try {
      await createBorrowing({
        itemId: selectedItem.id,
        quantity: borrowForm.quantity,
        borrowDate: borrowDate.toISOString(),
        expectedReturnDate: returnDate.toISOString(),
        purpose: borrowForm.purpose,
      });

      toast.success('Permintaan peminjaman berhasil diajukan');
      setIsBorrowModalOpen(false);
      setSelectedItem(null);
      setBorrowForm({
        quantity: 1,
        borrowDate: '',
        expectedReturnDate: '',
        purpose: '',
      });
      loadData(); // Refresh items to update availability
    } catch (error) {
      console.error('Failed to submit borrowing request:', error);
    }
  };

  const handleReadDescription = (item) => {
    setViewingItem(item);
    setIsDescriptionModalOpen(true);
  };

  const getConditionColor = (condition) => {
    const colors = {
      good: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      broken: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    return colors[condition] || colors.good;
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cari Barang</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Cari barang yang tersedia dan ajukan peminjaman
          </p>
        </div>
      </div>

      {user?.isBlockedFromBorrowing ? (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-[2rem] p-8 sm:p-16 text-center shadow-xl mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-red-100 dark:bg-red-900/30 rounded-full mb-6 sm:mb-8 text-red-600 dark:text-red-400">
            <FiInfo size={48} className="animate-pulse" />
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-red-900 dark:text-red-300 uppercase tracking-tighter mb-4">
            Akses Ditangguhkan
          </h2>
          <p className="text-sm sm:text-lg text-red-700 dark:text-red-400 font-medium max-w-2xl mx-auto leading-relaxed">
            {user.blockReason || 'Anda tidak diizinkan untuk melihat daftar barang karena ada peminjaman yang terlambat. Silakan kembalikan barang terlebih dahulu.'}
          </p>
        </div>
      ) : (
        <>
      {/* Simplified Filters Section */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Search Bar */}
          <div className="lg:col-span-5 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari peralatan..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 focus:border-primary-500 dark:focus:border-primary-400 rounded-xl outline-none text-sm font-medium transition-all"
            />
          </div>

          {/* Grouped Dropdowns */}
          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="relative group">
              <FiGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-gray-400"
              >
                <option value="all">Kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>


            <div className="relative group col-span-2 md:col-span-1">
              <FiPackage className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-all text-gray-500 dark:text-gray-400"
              >
                <option value="all">Ketersediaan</option>
                <option value="available">Tersedia</option>
                <option value="unavailable">Habis</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="card">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 animate-pulse">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto h-24 w-24 text-gray-400">
              <FiPackage className="h-full w-full" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Tidak ada barang ditemukan
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {items.length === 0
                ? "Tidak ada peralatan yang tersedia saat ini."
                : "Tidak ada barang yang sesuai dengan kriteria pencarian Anda."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 sm:p-6 hover:shadow-lg transition-shadow border border-gray-100 dark:border-gray-600/50 flex flex-col"
              >
                <div className="relative h-32 sm:h-48 overflow-hidden rounded-t-lg mb-4 -mx-3 sm:-mx-6 -mt-3 sm:-mt-6">
                  {item.image ? (
                    <img
                      className="absolute inset-0 h-full w-full object-cover"
                      src={`${import.meta.env.VITE_WS_URL || 'http://localhost:5000'}${item.image}`}
                      alt={item.name}
                      onError={(e) => {
                        e.target.style.display = 'none'; // Hide if broken
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <FiPackage className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white truncate">
                      {item.name}
                    </h3>
                  </div>
                  <div className="flex shrink-0 flex-col space-y-2 ml-4">
                    <button
                      onClick={() => handleBorrowClick(item)}
                      className={`btn-primary text-[10px] sm:text-xs py-1 px-3 shadow-sm ${user?.isBlockedFromBorrowing ? 'opacity-50 bg-red-400 hover:bg-red-500 border-none' : ''}`}
                      disabled={!item.isAvailable || item.availableQuantity === 0}
                    >
                      Pinjam
                    </button>
                    <button
                      onClick={() => handleReadDescription(item)}
                      className="flex items-center justify-center py-1 px-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-[10px] sm:text-xs font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-all border border-gray-100 dark:border-gray-600"
                    >
                      <FiInfo className="mr-1" /> Read
                    </button>
                  </div>
                </div>

                <div className="space-y-2 sm:space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">Kategori</span>
                    <span className="text-[10px] sm:text-sm font-medium truncate ml-2">
                      {typeof item.category === 'object' ? item.category.name : 'Memuat...'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">Stok</span>
                    <span className="text-[10px] sm:text-sm font-bold text-primary-600">
                      {item.availableQuantity} / {item.quantity}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-sm text-gray-500 dark:text-gray-400">Status</span>
                    {item.isAvailable && item.availableQuantity > 0 ? (
                      <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-sm font-bold">
                        <FaCheckCircle className="mr-1" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-red-600 dark:text-red-400 text-[10px] sm:text-sm font-bold">
                        <FaTimesCircle className="mr-1" /> NO
                      </span>
                    )}
                  </div>
                </div>

                {item.serialNumber && (
                  <div className="mt-4 pt-4 border-t dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Seri: {item.serialNumber}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="card border-l-4 border-l-primary-500">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-primary-100 dark:bg-primary-900/30 mr-4">
              <FiPackage className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Barang</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {items.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-green-500">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30 mr-4">
              <FaCheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tersedia</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {items.filter(item => item.isAvailable && item.availableQuantity > 0).length}
              </p>
            </div>
          </div>
        </div>

        <div className="card border-l-4 border-l-blue-500">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 mr-4">
              <FiCalendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kategori</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {categories.length}
              </p>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Borrow Modal */}
      {isBorrowModalOpen && selectedItem && (
        <div className="fixed inset-0 z-30 overflow-y-auto pt-16 sm:pt-20">
          <div className="flex items-center justify-center min-h-[calc(100vh-5rem)] px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setIsBorrowModalOpen(false)}
            />

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full sm:p-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Permintaan Peminjaman
                </h3>

                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {selectedItem.name}
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Tersedia:</span>
                      <span className="ml-2 font-medium">{selectedItem.availableQuantity}</span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleBorrowSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Jumlah *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedItem.availableQuantity}
                      value={borrowForm.quantity}
                      onChange={(e) => setBorrowForm({
                        ...borrowForm,
                        quantity: parseInt(e.target.value) || 1
                      })}
                      className="input-field"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Maksimum {selectedItem.availableQuantity} barang tersedia
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tanggal Pinjam *
                      </label>
                      <input
                        type={borrowForm.borrowDate ? 'date' : 'text'}
                        onFocus={(e) => (e.target.type = 'date')}
                        onBlur={(e) => (e.target.type = borrowForm.borrowDate ? 'date' : 'text')}
                        placeholder="Pilih Tanggal"
                        value={borrowForm.borrowDate}
                        onChange={(e) => setBorrowForm({
                          ...borrowForm,
                          borrowDate: e.target.value
                        })}
                        className="input-field"
                        min={format(new Date(), 'yyyy-MM-dd')}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tanggal Kembali *
                      </label>
                      <input
                        type={borrowForm.expectedReturnDate ? 'date' : 'text'}
                        onFocus={(e) => (e.target.type = 'date')}
                        onBlur={(e) => (e.target.type = borrowForm.expectedReturnDate ? 'date' : 'text')}
                        placeholder="Pilih Tanggal"
                        value={borrowForm.expectedReturnDate}
                        onChange={(e) => setBorrowForm({
                          ...borrowForm,
                          expectedReturnDate: e.target.value
                        })}
                        className="input-field"
                        min={borrowForm.borrowDate || format(new Date(), 'yyyy-MM-dd')}
                        required
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Tentukan rentang tanggal untuk peminjaman Anda
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tujuan *
                    </label>
                    <textarea
                      value={borrowForm.purpose}
                      onChange={(e) => setBorrowForm({
                        ...borrowForm,
                        purpose: e.target.value
                      })}
                      rows="3"
                      className="input-field"
                      placeholder="Silakan jelaskan mengapa Anda membutuhkan peralatan ini..."
                      required
                    />
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsBorrowModalOpen(false)}
                      className="btn-secondary"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                    >
                      Ajukan Permintaan
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h4 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">
          Cara Meminjam Peralatan
        </h4>
        <ul className="text-blue-700 dark:text-blue-400 space-y-1 text-sm">
          <li>• Cari peralatan yang tersedia menggunakan pencarian dan filter</li>
          <li>• Klik "Pinjam" pada barang yang tersedia</li>
          <li>• Tentukan jumlah dan tanggal pengembalian yang diharapkan</li>
          <li>• Berikan tujuan peminjaman yang jelas</li>
          <li>• Ajukan permintaan untuk persetujuan petugas</li>
          <li>• Anda akan diberitahu saat permintaan Anda disetujui atau ditolak</li>
        </ul>
      </div>
      {/* Description Modal */}
      {isDescriptionModalOpen && viewingItem && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4 pt-20 sm:pt-24 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                  <FiInfo className="text-primary-600 dark:text-primary-400" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white uppercase tracking-tight">Deskripsi Barang</h3>
                  <p className="text-xs text-gray-500">{viewingItem.name}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-slate-700/50 rounded-2xl border border-gray-100 dark:border-slate-600 mb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed italic">
                  {viewingItem.description || 'Tidak ada deskripsi tersedia untuk barang ini.'}
                </p>
              </div>

              <button
                onClick={() => setIsDescriptionModalOpen(false)}
                className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrowseItems;