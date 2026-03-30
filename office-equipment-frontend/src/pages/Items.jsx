import React, { useState, useEffect } from 'react';
import { itemsAPI } from '../api/items';
import { categoriesAPI } from '../api/categories';
import { useApi } from '../hooks/useApi';
import { useForm } from '../hooks/useForm';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { FiEdit2, FiTrash2, FiPlus, FiSearch, FiUpload, FiEye, FiPackage, FiGrid, FiMapPin, FiInfo, FiHash, FiArchive, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const Items = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [conditionFilter, setConditionFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const { execute: fetchItems, loading } = useApi(itemsAPI.getAllItems);
  const { execute: fetchCategories } = useApi(categoriesAPI.getAllCategories);
  const { execute: createItem } = useApi(itemsAPI.createItem);
  const { execute: updateItem } = useApi(itemsAPI.updateItem);
  const { execute: deleteItem } = useApi(itemsAPI.deleteItem);

  const { values, setValues, handleChange, handleBlur, resetForm } = useForm({
    name: '', description: '', categoryId: '', serialNumber: '', quantity: 1, condition: 'good', location: '',
  });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { filterItems(); }, [items, searchTerm, selectedCategory, conditionFilter, availabilityFilter]);

  const loadData = async () => {
    try {
      const [data, categoriesData] = await Promise.all([fetchItems(), fetchCategories()]);

      // Handle both old array format and new paginated object format for items
      if (data && data.items) {
        setItems(data.items);
      } else if (Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }

      setCategories(categoriesData);
    } catch (error) { }
  };

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

  const filterItems = () => {
    let filtered = [...items];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => item.name.toLowerCase().includes(term) || item.serialNumber?.toLowerCase().includes(term));
    }
    if (selectedCategory !== 'all') filtered = filtered.filter(item => String(typeof item.category === 'object' ? item.category.id : item.categoryId) === String(selectedCategory));
    if (conditionFilter !== 'all') filtered = filtered.filter(item => item.condition === conditionFilter);
    if (availabilityFilter !== 'all') {
      if (availabilityFilter === 'available') filtered = filtered.filter(item => item.availableQuantity > 0);
      else filtered = filtered.filter(item => item.availableQuantity === 0);
    }
    setFilteredItems(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      Object.keys(values).forEach(key => formData.append(key, values[key]));
      if (imageFile) formData.append('image', imageFile);
      if (editingItem) await updateItem(editingItem.id, formData);
      else await createItem(formData);
      handleCloseModal();
      loadData();
      toast.success('Item saved successfully');
    } catch (error) { }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setValues({ ...item, categoryId: typeof item.category === 'object' ? item.category.id : item.categoryId });
    setImagePreview(item.image ? `${import.meta.env.VITE_WS_URL || 'http://localhost:5000'}${item.image}` : null);
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setImageFile(null);
    setImagePreview(null);
    resetForm();
  };

  const handleView = (item) => { setViewingItem(item); setIsViewModalOpen(true); };
  const handleDeleteClick = (item) => { setItemToDelete(item); setIsDeleteModalOpen(true); };
  const confirmDelete = async () => { try { await deleteItem(itemToDelete.id); loadData(); } finally { setIsDeleteModalOpen(false); } };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setImagePreview(reader.result); setImageFile(file); };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Inventaris</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Kelola peralatan kantor dan ketersediaan</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={() => { setEditingItem(null); resetForm(); setImagePreview(null); setImageFile(null); setIsModalOpen(true); }} className="btn-primary">
            <FiPlus size={20} className="mr-2" /> Tambah Barang
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari barang..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-sm"
            />
          </div>
          <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="relative">
              <FiGrid className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600 h-4 w-4" />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold uppercase tracking-wider appearance-none">
                <option value="all">Kategori</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name || c.id}</option>)}
              </select>
            </div>
            <div className="relative">
              <FiPackage className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600 h-4 w-4" />
              <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-xl outline-none text-xs font-bold uppercase tracking-wider appearance-none">
                <option value="all">Ketersediaan</option>
                <option value="available">Tersedia</option>
                <option value="unavailable">Habis</option>
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
                <img src={`${import.meta.env.VITE_WS_URL || 'http://localhost:5000'}${item.image}`} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300"><FiPackage size={48} /></div>
              )}
            </div>
            <div className="p-4 flex-grow">
              <h3 className="font-bold text-gray-900 dark:text-white mb-1 truncate">{item.name}</h3>
              <p className="text-xs text-gray-500 mb-2">{item.serialNumber || 'Tanpa Serial'}</p>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-50 dark:border-slate-800">
                <span className="text-sm font-bold text-primary-600">{item.availableQuantity} / {item.quantity}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleView(item)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg" title="View Details"><FiEye size={18} /></button>
                  {user?.role === 'admin' && (
                    <>
                      <button onClick={() => handleEdit(item)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg" title="Edit Item"><FiEdit2 size={18} /></button>
                      <button onClick={() => handleDeleteClick(item)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg" title="Delete Item"><FiTrash2 size={18} /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-white/20">
            <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  {editingItem ? 'Ubah Barang' : 'Tambah Barang Baru'}
                </h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Manajemen Inventaris</p>
              </div>
              <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <FiX size={20} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nama Barang</label>
                  <div className="relative">
                    <FiPackage className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                    <input name="name" value={values.name} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none text-sm font-bold focus:border-primary-500 transition-all" placeholder="misal: Dell Latitude 5420" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Kategori</label>
                  <div className="relative">
                    <FiGrid className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                    <select name="categoryId" value={values.categoryId} onChange={handleChange} className="w-full pl-12 pr-10 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none text-sm font-bold appearance-none focus:border-primary-500 transition-all" required>
                      <option value="">Pilih Kategori</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nomor Serial</label>
                  <div className="relative">
                    <FiHash className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                    <input name="serialNumber" value={values.serialNumber} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none text-sm font-bold focus:border-primary-500 transition-all" placeholder="Opsional" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Jumlah Total</label>
                  <div className="relative">
                    <FiArchive className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                    <input type="number" name="quantity" value={values.quantity} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none text-sm font-bold focus:border-primary-500 transition-all" min="1" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Kondisi</label>
                  <div className="relative">
                    <FiInfo className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                    <select name="condition" value={values.condition} onChange={handleChange} className="w-full pl-12 pr-10 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none text-sm font-bold appearance-none focus:border-primary-500 transition-all">
                      <option value="good">Baik</option>
                      <option value="broken">Rusak</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lokasi</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600" />
                    <input name="location" value={values.location} onChange={handleChange} className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none text-sm font-bold focus:border-primary-500 transition-all" placeholder="misal: Gudang A" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Deskripsi</label>
                <textarea name="description" value={values.description} onChange={handleChange} className="w-full p-4 bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none text-sm font-medium focus:border-primary-500 transition-all min-h-[100px]" placeholder="Tambahkan detail teknis..." />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Foto Produk</label>
                <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700 hover:border-primary-500 transition-all group">
                  <div className="w-24 h-24 rounded-xl bg-white dark:bg-slate-800 overflow-hidden border border-gray-100 dark:border-slate-700 flex-shrink-0">
                    {imagePreview ? (
                      <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><FiPackage size={32} /></div>
                    )}
                  </div>
                  <label className="flex-grow flex flex-col items-center justify-center py-4 cursor-pointer">
                    <FiUpload size={24} className="text-primary-600 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Klik untuk unggah foto</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase mt-1">JPG, PNG maksimal 5MB</span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={handleCloseModal} className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-all">Batal</button>
                <button type="submit" className="flex-1 py-4 bg-primary-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition-all">Simpan Barang</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/20">
            <div className="relative h-48 bg-gray-100 dark:bg-slate-800">
              {viewingItem.image ? (
                <img src={`${import.meta.env.VITE_WS_URL || 'http://localhost:5000'}${viewingItem.image}`} className="w-full h-full object-cover" alt={viewingItem.name} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300"><FiPackage size={64} /></div>
              )}
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-all">
                <FiX size={20} />
              </button>
            </div>

            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{viewingItem.name}</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                    {typeof viewingItem.category === 'object' ? viewingItem.category.name : 'Tanpa Kategori'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-primary-600 uppercase tracking-widest">Ketersediaan</p>
                  <p className="text-xl font-black text-gray-900 dark:text-white">{viewingItem.availableQuantity} <span className="text-sm font-bold text-gray-400">/ {viewingItem.quantity}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-primary-600"><FiHash size={20} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Serial</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{viewingItem.serialNumber || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-primary-600"><FiMapPin size={20} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Lokasi</p>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{viewingItem.location || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deskripsi</p>
                <div className="p-4 bg-gray-50 dark:bg-slate-800/30 rounded-2xl border border-gray-100 dark:border-slate-800 text-sm text-gray-600 dark:text-gray-400 leading-relaxed italic">
                  {viewingItem.description || 'Tidak ada deskripsi.'}
                </div>
              </div>

              <button onClick={() => setIsViewModalOpen(false)} className="w-full mt-8 py-4 bg-gray-900 dark:bg-slate-800 text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-black transition-all">Tutup Detail</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Hapus Barang"
        message="Apakah Anda yakin ingin menghapus barang ini?"
        confirmText="Hapus"
        type="danger"
        icon={FiTrash2}
      />
    </div>
  );
};

export default Items;