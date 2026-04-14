import React, { useState, useEffect } from 'react';
import { itemsAPI } from '../api/items';
import { categoriesAPI } from '../api/categories';
import { usersAPI } from '../api/users';
import { useApi } from '../hooks/useApi';
import { useForm } from '../hooks/useForm';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { FiEdit2, FiTrash2, FiPlus, FiSearch, FiUpload, FiEye, FiPackage, FiGrid, FiMapPin, FiInfo, FiHash, FiArchive, FiX, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const Items = () => {
  // --- State & Konteks ---
  const { user } = useAuth(); // Data pengguna yang sedang login
  const socket = useSocket(); // Koneksi WebSocket untuk pembaruan real-time
  const [items, setItems] = useState([]); // Daftar semua barang dari API
  const [categories, setCategories] = useState([]); // Daftar kategori barang
  const [officers, setOfficers] = useState([]); // Daftar petugas (untuk pengelolaan barang)
  const [filteredItems, setFilteredItems] = useState([]); // Barang yang difilter untuk ditampilkan
  const [searchTerm, setSearchTerm] = useState(''); // Kata kunci pencarian
  const [selectedCategory, setSelectedCategory] = useState('all'); // Filter kategori yang dipilih
  const [conditionFilter, setConditionFilter] = useState('all'); // Filter kondisi yang dipilih
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // Filter ketersediaan yang dipilih

  // State Manajemen Modal
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal Tambah/Edit
  const [isViewModalOpen, setIsViewModalOpen] = useState(false); // Modal Detail Barang
  const [editingItem, setEditingItem] = useState(null); // Barang yang sedang diedit
  const [viewingItem, setViewingItem] = useState(null); // Barang yang sedang dilihat
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // Modal Konfirmasi Hapus
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false); // Modal Konfirmasi Simpan
  const [itemToDelete, setItemToDelete] = useState(null); // Barang yang akan dihapus

  // State Unggah Gambar
  const [imagePreview, setImagePreview] = useState(null); // Pratinjau gambar sebelum diunggah
  const [imageFile, setImageFile] = useState(null); // File gambar asli

  // --- Hook API ---
  const { execute: fetchItems, loading } = useApi(itemsAPI.getAllItems);
  const { execute: fetchCategories } = useApi(categoriesAPI.getAllCategories);
  const { execute: fetchUsers } = useApi(usersAPI.getAllUsers);
  const { execute: createItem } = useApi(itemsAPI.createItem);
  const { execute: updateItem } = useApi(itemsAPI.updateItem);
  const { execute: deleteItem } = useApi(itemsAPI.deleteItem);

  // Penanganan formulir menggunakan hook kustom useForm
  const { values, setValues, handleChange, handleBlur, resetForm } = useForm({
    name: '', description: '', categoryId: '', serialNumber: '', quantity: 1, brokenQuantity: 0, condition: 'good', location: '', managedBy: '',
  });

  // --- Lifecycle & Efek ---

  // Memuat data awal saat komponen dipasang
  useEffect(() => { loadData(); }, []);

  // Jalankan filter setiap kali data barang atau kriteria filter berubah
  useEffect(() => { filterItems(); }, [items, searchTerm, selectedCategory, conditionFilter, availabilityFilter]);

  /**
   * Mengambil data barang, kategori, dan petugas dari server secara paralel
   */
  const loadData = async () => {
    try {
      const [data, categoriesData, usersData] = await Promise.all([
        fetchItems(),
        fetchCategories(),
        fetchUsers({ role: 'officer', limit: 1000 })
      ]);

      if (data && data.items) {
        setItems(data.items);
      } else if (Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }
      setCategories(categoriesData);
      setOfficers(usersData.users || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  /**
   * Listener real-time menggunakan Socket.io untuk mendeteksi perubahan data dari klien lain
   */
  useEffect(() => {
    if (!socket) return;
    const updateHandler = () => loadData();
    socket.on('item:created', updateHandler);
    socket.on('item:updated', updateHandler);
    socket.on('item:deleted', updateHandler);
    return () => {
      socket.off('item:created', updateHandler);
      socket.off('item:updated', updateHandler);
      socket.off('item:deleted', updateHandler);
    };
  }, [socket]);

  /**
   * Logika pencarian dan filter di sisi klien
   */
  const filterItems = () => {
    let filtered = [...items];

    // Filter by keyword (Name or Serial Number)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(term) ||
        item.serialNumber?.toLowerCase().includes(term)
      );
    }

    // Filter berdasarkan Kategori
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item =>
        String(typeof item.category === 'object' ? item.category.id : item.categoryId) === String(selectedCategory)
      );
    }

    // Filter berdasarkan Kondisi
    if (conditionFilter !== 'all') {
      filtered = filtered.filter(item => item.condition === conditionFilter);
    }

    // Filter berdasarkan Ketersediaan Stok
    if (availabilityFilter !== 'all') {
      if (availabilityFilter === 'available') filtered = filtered.filter(item => item.availableQuantity > 0);
      else filtered = filtered.filter(item => item.availableQuantity === 0);
    }

    setFilteredItems(filtered);
  };

  /**
   * Tampilkan konfirmasi sebelum menyimpan data (Tambah/Perbarui)
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitModalOpen(true);
  };

  /**
   * Eksekusi akhir untuk menyimpan data ke server (menggunakan FormData untuk file gambar)
   */
  const confirmSubmit = async () => {
    try {
      const formData = new FormData();
      Object.keys(values).forEach(key => formData.append(key, values[key]));
      if (imageFile) formData.append('image', imageFile);

      if (editingItem) {
        await updateItem(editingItem.id, formData);
        toast.success('Item updated successfully');
      } else {
        await createItem(formData);
        toast.success('Item added successfully');
      }

      handleCloseModal();
      loadData();
    } catch (error) {
      toast.error('Failed to save data');
    }
  };

  /**
   * Siapkan modal edit dengan data barang yang dipilih
   */
  const handleEdit = (item) => {
    setEditingItem(item);
    setValues({
      ...item,
      categoryId: typeof item.category === 'object' ? item.category.id : item.categoryId,
      managedBy: item.managedBy || '',
      brokenQuantity: item.brokenQuantity || 0,
      description: item.description || '',
      serialNumber: item.serialNumber || '',
      location: item.location || ''
    });
    setImagePreview(item.image ? `${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${item.image}` : null);
    setImageFile(null);
    setIsModalOpen(true);
  };

  /**
   * Bersihkan state saat modal ditutup
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setImageFile(null);
    setImagePreview(null);
    resetForm();
  };

  // Fungsi pembantu aksi UI
  const handleView = (item) => { setViewingItem(item); setIsViewModalOpen(true); };
  const handleDeleteClick = (item) => { setItemToDelete(item); setIsDeleteModalOpen(true); };

  /**
   * Eksekusi penghapusan barang
   */
  const confirmDelete = async () => {
    try {
      await deleteItem(itemToDelete.id);
      loadData();
      toast.success('Item deleted successfully');
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  /**
   * Penanganan unggah gambar: menghasilkan pratinjau lokal (Base64)
   */
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Manage equipment and availability</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'officer') && (
          <button onClick={() => { setEditingItem(null); resetForm(); setImagePreview(null); setImageFile(null); setIsModalOpen(true); }} className="btn-primary">
            <FiPlus size={20} className="mr-2" /> Add Item
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-none shadow-sm border border-gray-100 dark:border-slate-800 p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm"
            />
          </div>
          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="relative">
              <FiGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-4 w-4" />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-xs font-bold uppercase tracking-wider appearance-none">
                <option value="all">Category</option>
                {categories
                  .filter(c => user?.role === 'admin' || c.managingDepartment === user?.department)
                  .map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)
                }
              </select>
            </div>
            <div className="relative">
              <FiPackage className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-4 w-4" />
              <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-xs font-bold uppercase tracking-wider appearance-none">
                <option value="all">Availability</option>
                <option value="available">Available</option>
                <option value="unavailable">Out of Stock</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <div key={item.id} className="card overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
            <div className="h-32 bg-gray-100 dark:bg-slate-800 relative group overflow-hidden">
              {item.image ? (
                <img src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${item.image}`} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300"><FiPackage size={48} /></div>
              )}
            </div>
            <div className="p-4 flex-grow">
              <h3 className="font-bold text-gray-900 dark:text-white mb-1 truncate">{item.name}</h3>
              <p className="text-xs text-gray-500 mb-2">{item.serialNumber || 'No Serial'}</p>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50 dark:border-slate-800">
                <span className="text-sm font-bold text-theme-primary">{item.availableQuantity} / {item.quantity}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleView(item)} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none" title="View Details"><FiEye size={18} /></button>
                  {(user?.role === 'admin' || user?.role === 'officer') && (
                    <>
                      <button onClick={() => handleEdit(item)} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none" title="Edit Item"><FiEdit2 size={18} /></button>
                      <button onClick={() => handleDeleteClick(item)} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none" title="Delete Item"><FiTrash2 size={18} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-none w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
            <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Inventory Management</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-none transition-colors">
                <FiX size={20} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Item Name</label>
                  <div className="relative">
                    <FiPackage className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary" />
                    <input name="name" value={values.name} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-bold focus:border-theme-primary transition-all" placeholder="e.g. Dell Latitude 5420" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category</label>
                  <div className="relative">
                    <FiGrid className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary" />
                    <select name="categoryId" value={values.categoryId} onChange={handleChange} className="w-full pl-12 pr-10 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-bold appearance-none focus:border-theme-primary transition-all" required>
                      <option value="">Select Category</option>
                      {categories
                        .filter(c => user?.role === 'admin' || c.managingDepartment === user?.department)
                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Serial Number</label>
                  <div className="relative">
                    <FiHash className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary" />
                    <input name="serialNumber" value={values.serialNumber} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-bold focus:border-theme-primary transition-all" placeholder="Optional" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Total Quantity</label>
                  <div className="relative">
                    <FiArchive className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary" />
                    <input type="number" name="quantity" value={values.quantity} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-bold focus:border-theme-primary transition-all" min="1" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Overall Condition</label>
                  <div className="relative">
                    <FiInfo className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary" />
                    <select name="condition" value={values.condition || 'good'} onChange={(e) => {
                      const newCondition = e.target.value;
                      setValues(prev => ({
                        ...prev,
                        condition: newCondition,
                        brokenQuantity: newCondition === 'good' ? 0 : (prev.brokenQuantity || 1)
                      }));
                    }} className="w-full pl-12 pr-10 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-bold appearance-none focus:border-theme-primary transition-all">
                      <option value="good">Good</option>
                      <option value="broken">Has Broken Items</option>
                    </select>
                  </div>
                </div>
                {values.condition === 'broken' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Broken Quantity</label>
                    <div className="relative">
                      <FiArchive className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary" />
                      <input type="number" name="brokenQuantity" value={values.brokenQuantity} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-bold focus:border-theme-primary transition-all" min="1" max={values.quantity} required />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Location</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary" />
                    <input name="location" value={values.location} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-bold focus:border-theme-primary transition-all" placeholder="e.g. Warehouse A" />
                  </div>
                </div>

                {user?.role === 'admin' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Manager (Officer)</label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary" />
                      <select name="managedBy" value={values.managedBy} onChange={handleChange} className="w-full pl-12 pr-10 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-bold appearance-none focus:border-theme-primary transition-all">
                        <option value="">Select Officer (Optional)</option>
                        {officers.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.fullName} ({o.department})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Description</label>
                <textarea name="description" value={values.description} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm font-medium focus:border-theme-primary transition-all min-h-[100px]" placeholder="Add technical details..." />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Product Photo</label>
                <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-slate-800/30 rounded-none border border-dashed border-gray-200 dark:border-slate-700 hover:border-theme-primary transition-all group">
                  <div className="w-24 h-24 rounded-none bg-white dark:bg-slate-800 overflow-hidden border border-gray-100 dark:border-slate-700 flex-shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><FiPackage size={32} /></div>
                    )}
                  </div>
                  <label className="flex-grow flex flex-col items-center justify-center py-4 cursor-pointer">
                    <FiUpload size={24} className="text-theme-primary mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Click to upload photo</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase mt-1">JPG, PNG max 5MB</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-none font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-4 bg-theme-primary text-white rounded-none font-bold uppercase tracking-widest text-xs shadow-lg shadow-theme-primary/30 hover:bg-theme-primary transition-all">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lihat Detail */}
      {isViewModalOpen && viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-none w-full max-w-lg overflow-hidden shadow-2xl border border-white/20">
            <div className="relative h-48 bg-gray-100 dark:bg-slate-800">
              {viewingItem.image ? (
                <img src={`${import.meta.env.VITE_WS_URL || `http://${window.location.hostname}:5000`}${viewingItem.image}`} className="w-full h-full object-cover" alt={viewingItem.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300"><FiPackage size={64} /></div>
              )}
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-none text-white transition-all">
                <FiX size={20} />
              </button>
            </div>

            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{viewingItem.name}</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                    {typeof viewingItem.category === 'object' ? viewingItem.category.name : 'No Category'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-primary-600 uppercase tracking-widest">Availability</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{viewingItem.availableQuantity} <span className="text-sm font-bold text-gray-400">/ {viewingItem.quantity}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-none bg-red-50 dark:bg-red-900/10 flex items-center justify-center text-red-500"><FiArchive size={20} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Broken Items</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{viewingItem.brokenQuantity || 0} unit(s)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-none bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-theme-primary"><FiHash size={20} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Serial</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{viewingItem.serialNumber || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-none bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-primary-600"><FiMapPin size={20} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Location</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{viewingItem.location || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-none bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-primary-600"><FiUser size={20} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Manager</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {viewingItem.manager ? `${viewingItem.manager.fullName} (${viewingItem.manager.department})` : 'System Administrator'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</p>
                <div className="p-4 bg-gray-50 dark:bg-slate-800/30 rounded-none border border-gray-100 dark:border-slate-800 text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic">
                  {viewingItem.description || 'No description available.'}
                </div>
              </div>

              <button onClick={() => setIsViewModalOpen(false)} className="w-full mt-8 py-4 bg-gray-900 dark:bg-slate-800 text-white rounded-none font-bold uppercase tracking-widest text-xs hover:bg-black transition-all">Close Details</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={confirmSubmit}
        title={editingItem ? "Update Item" : "Add Item"}
        message={`Are you sure you want to ${editingItem ? 'update' : 'add'} item "${values.name}"?`}
        confirmText={editingItem ? "Update" : "Add"}
        type="primary"
        icon={editingItem ? FiEdit2 : FiPlus}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        confirmText="Delete"
        type="danger"
        icon={FiTrash2}
      />
    </div>
  );
};

export default Items;