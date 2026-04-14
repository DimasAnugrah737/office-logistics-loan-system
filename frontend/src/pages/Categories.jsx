import React, { useState, useEffect } from 'react';
import { categoriesAPI } from '../api/categories';
import { useApi } from '../hooks/useApi';
import { useForm } from '../hooks/useForm';
import { useSocket } from '../contexts/SocketContext';
import { FiEdit2, FiTrash2, FiPlus, FiSearch, FiGrid, FiPackage, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import ConfirmationModal from '../components/ConfirmationModal';

const Categories = () => {
  const { isAdmin } = useAuth();
  const socket = useSocket();
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const { execute: fetchCategories, loading } = useApi(categoriesAPI.getAllCategories);
  const { execute: createCategory } = useApi(categoriesAPI.createCategory);
  const { execute: updateCategory } = useApi(categoriesAPI.updateCategory);
  const { execute: deleteCategory } = useApi(categoriesAPI.deleteCategory);

  const { values, setValues, handleChange, handleBlur, resetForm } = useForm({ name: '', code: '', description: '', managingDepartment: '' });

  useEffect(() => { loadData(); }, []);
  useEffect(() => { filterCategories(); }, [categories, searchTerm]);

  const loadData = async () => {
    try {
      const categoriesData = await fetchCategories();
      setCategories(categoriesData);
    } catch (error) { }
  };

  useEffect(() => {
    if (!socket) return;
    const updateHandler = () => loadData();
    socket.on('category:created', updateHandler);
    socket.on('category:updated', updateHandler);
    socket.on('category:deleted', updateHandler);
    return () => {
      socket.off('category:created', updateHandler);
      socket.off('category:updated', updateHandler);
      socket.off('category:deleted', updateHandler);
    };
  }, [socket]);

  const filterCategories = () => {
    let filtered = [...categories];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.code.toLowerCase().includes(term)
      );
    }
    setFilteredCategories(filtered);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitModalOpen(true);
  };

  const confirmSubmit = async () => {
    try {
      if (editingCategory) await updateCategory(editingCategory.id, values);
      else await createCategory(values);
      setIsModalOpen(false);
      loadData();
      toast.success('Category saved successfully');
    } catch (error) { }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setValues({ 
      name: category.name, 
      code: category.code || '',
      description: category.description || '', 
      managingDepartment: category.managingDepartment || '' 
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (category) => { setCategoryToDelete(category); setIsDeleteModalOpen(true); };
  const confirmDelete = async () => { try { await deleteCategory(categoryToDelete.id); loadData(); } finally { setIsDeleteModalOpen(false); } };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Categories</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Manage equipment categories</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditingCategory(null); resetForm(); setIsModalOpen(true); }} className="btn-primary">
            <FiPlus className="mr-2" /> Add Category
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-none shadow-sm border border-gray-100 dark:border-slate-800 p-4 mb-6">
        <div className="max-w-md relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-primary h-5 w-5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCategories.map((category) => (
          <div key={category.id} className="card p-5 group hover:shadow-lg transition-all">
            <div className="flex items-center gap-4 mb-4">
               <div className="w-10 h-10 bg-theme-primary-light rounded-none flex items-center justify-center text-theme-primary relative">
                <FiGrid size={20} />
                <span className="absolute -top-1 -right-1 text-[8px] font-black bg-theme-primary text-white px-1 py-0.5">{category.code}</span>
              </div>
              <div className="flex-grow">
                <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{category.name}</h3>
                <div className="flex flex-col">
                  {category.managingDepartment && (
                    <p className="text-[9px] font-medium text-theme-primary bg-theme-primary-light px-1.5 py-0.5 rounded-none self-start mt-1">
                      Managed By: {category.managingDepartment}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-50 dark:border-slate-800">
              {isAdmin && (
                <>
                  <button onClick={() => handleEdit(category)} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none"><FiEdit2 size={16} /></button>
                  <button onClick={() => handleDeleteClick(category)} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none"><FiTrash2 size={16} /></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmationModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={confirmSubmit}
        title={editingCategory ? "Update Category" : "Add Category"}
        message={`Are you sure you want to ${editingCategory ? 'update' : 'add'} category "${values.name}"?`}
        confirmText={editingCategory ? "Update" : "Save"}
        type="primary"
        icon={editingCategory ? FiEdit2 : FiPlus}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Category"
        message="Are you sure you want to delete this category?"
        confirmText="Delete"
        type="danger"
        icon={FiTrash2}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsModalOpen(false)} />
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-none px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500"><FiX size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Code</label>
                    <input name="code" value={values.code} onChange={handleChange} className="input-field" placeholder="e.g. ELEC" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Category Name</label>
                    <input name="name" value={values.name} onChange={handleChange} className="input-field" placeholder="e.g. Electronics" required />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Managing Unit</label>
                  <input
                    name="managingDepartment"
                    value={values.managingDepartment}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="e.g. IT, WAREHOUSE, LOGISTICS"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 italic">* Officers from this unit will handle borrowings for this category.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description</label>
                  <textarea name="description" value={values.description} onChange={handleChange} className="input-field min-h-[100px]" placeholder="Short description about this category..." />
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">
                    {editingCategory ? 'Update Category' : 'Save Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;