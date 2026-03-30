import React, { useState, useEffect } from 'react';
import { usersAPI } from '../api/users';
import { useApi } from '../hooks/useApi';
import { useForm } from '../hooks/useForm';
import { useSocket } from '../contexts/SocketContext';
import { FiEdit2, FiTrash2, FiUserPlus, FiSearch, FiEye, FiUsers, FiX, FiKey } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const Users = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const canManageUsers = isAdmin;
  const socket = useSocket();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState(null);

  const { execute: fetchUsers, loading } = useApi(usersAPI.getAllUsers);
  const { execute: createUser } = useApi(usersAPI.createUser);
  const { execute: updateUser } = useApi(usersAPI.updateUser);
  const { execute: deleteUser } = useApi(usersAPI.deleteUser);
  const { execute: resetPassword } = useApi(usersAPI.resetPassword);

  const { values, setValues, handleChange, handleBlur, resetForm } = useForm({
    fullName: '',
    nip: '',
    email: '',
    password: '',
    role: 'user',
    department: '',
    position: '',
    phone: '',
    isActive: true,
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, filterRole]);

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      // Handle both old array format and new paginated object format
      if (data && data.users) {
        setUsers(data.users);
      } else if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handleUserCreated = (newUser) => setUsers(prev => [newUser, ...prev]);
    const handleUserUpdated = (updatedUser) => setUsers(prev => prev.map(user => user.id === updatedUser.id ? updatedUser : user));
    const handleUserDeleted = (data) => setUsers(prev => prev.filter(user => user.id !== parseInt(data.id)));
    socket.on('user:created', handleUserCreated);
    socket.on('user:updated', handleUserUpdated);
    socket.on('user:deleted', handleUserDeleted);
    return () => {
      socket.off('user:created', handleUserCreated);
      socket.off('user:updated', handleUserUpdated);
      socket.off('user:deleted', handleUserDeleted);
    };
  }, [socket]);

  const filterUsers = () => {
    let filtered = [...users];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user => user.fullName.toLowerCase().includes(term) || user.nip.toLowerCase().includes(term) || user.email.toLowerCase().includes(term));
    }
    if (filterRole !== 'all') filtered = filtered.filter(user => user.role === filterRole);
    setFilteredUsers(filtered);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const { password, ...updateData } = values;
        if (!password) delete updateData.password;
        await updateUser(editingUser.id, updateData);
        toast.success('Pengguna berhasil diperbarui');
      } else {
        await createUser(values);
        toast.success('Pengguna berhasil dibuat');
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (error) { }
  };

  const handleEdit = (user) => {
    setIsViewOnly(false);
    setEditingUser(user);
    setValues({ ...user, password: '' });
    setIsModalOpen(true);
  };

  const handleView = (user) => {
    setIsViewOnly(true);
    setEditingUser(user);
    setValues({ ...user, password: '' });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteUser(userToDelete.id);
      toast.success('Pengguna berhasil dihapus');
      loadUsers();
    } finally {
      setIsDeleteModalOpen(false);
    }
  };

  const handleResetPasswordClick = (user) => {
    setUserToReset(user);
    setIsResetModalOpen(true);
  };

  const confirmResetPassword = async () => {
    try {
      await resetPassword(userToReset.id);
      toast.success('Password pengguna berhasil direset menjadi 123456');
    } catch (error) {
      toast.error('Gagal mereset password');
    } finally {
      setIsResetModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Pengguna</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Kelola pengguna sistem dan hak akses</p>
        </div>
        {canManageUsers && (
          <button onClick={() => { setIsViewOnly(false); setEditingUser(null); resetForm(); setIsModalOpen(true); }} className="btn-primary">
            <FiUserPlus className="mr-2" /> Tambah Pengguna
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-[2rem] shadow-xl shadow-gray-200/10 dark:shadow-none border border-gray-100 dark:border-slate-800 p-2 sm:p-3 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8 relative group rounded-2xl border border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 focus-within:border-primary-500/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-primary-500/5 transition-all duration-300">
            <label className="text-[8px] font-black text-primary-500 uppercase tracking-[0.2em] absolute top-2.5 left-11 z-10 group-focus-within:text-primary-600">Cari</label>
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600 h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nama, NIP, atau Email..."
              className="w-full pl-11 pr-4 pt-6 pb-2.5 bg-transparent outline-none text-[11px] font-bold dark:text-white placeholder-gray-300"
            />
          </div>
          <div className="md:col-span-4 relative group rounded-2xl border border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 focus-within:border-primary-500/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-primary-500/5 transition-all duration-300">
            <label className="text-[8px] font-black text-primary-500 uppercase tracking-[0.2em] absolute top-2.5 left-11 z-10 group-focus-within:text-primary-600">Peran</label>
            <FiUsers className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-600 h-4 w-4" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full pl-11 pr-8 pt-6 pb-2.5 bg-transparent outline-none text-[11px] font-bold uppercase tracking-wider appearance-none dark:text-white cursor-pointer"
            >
              <option value="all">Semua Peran</option>
              <option value="admin">Administrator</option>
              <option value="officer">Petugas</option>
              <option value="user">Pengguna</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="table-header">Pengguna</th>
                <th className="table-header">NIP</th>
                <th className="table-header">Peran</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center border border-primary-200 dark:border-primary-800">
                        <span className="text-sm font-bold text-primary-600 dark:text-primary-300">{user.fullName ? user.fullName.charAt(0) : '?'}</span>
                      </div>
                      <div className="ml-3 font-medium text-gray-900 dark:text-white">{user.fullName}</div>
                    </div>
                  </td>
                  <td className="table-cell font-mono text-xs">{user.nip}</td>
                  <td className="table-cell">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
                      {user.role === 'admin' ? 'Admin' : user.role === 'officer' ? 'Petugas' : 'User'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>{user.isActive ? 'Aktif' : 'Nonaktif'}</span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleView(user)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><FiEye size={18} /></button>
                      {canManageUsers && (
                        <>
                          {isAdmin && (
                            <button onClick={() => handleResetPasswordClick(user)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg" title="Reset Password"><FiKey size={18} /></button>
                          )}
                          <button onClick={() => handleEdit(user)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><FiEdit2 size={18} /></button>
                          <button onClick={() => handleDeleteClick(user)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg"><FiTrash2 size={18} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Hapus Pengguna"
        message="Apakah Anda yakin ingin menghapus pengguna ini?"
        confirmText="Hapus"
        type="danger"
        icon={FiTrash2}
      />

      <ConfirmationModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={confirmResetPassword}
        title="Reset Password Pengguna"
        message={`Apakah Anda yakin ingin mereset password untuk pengguna ${userToReset?.fullName || userToReset?.nip}? Password akan diubah menjadi 123456.`}
        confirmText="Reset"
        type="warning"
        icon={FiKey}
      />

      {/* User Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsModalOpen(false)} />
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-2xl px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isViewOnly ? 'Detail Pengguna' : editingUser ? 'Ubah Pengguna' : 'Tambah Pengguna Baru'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500"><FiX size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Selalu munculkan NIP dan Peran */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">NIP</label>
                    <input name="nip" value={values.nip} onChange={handleChange} className="input-field" readOnly={isViewOnly} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Peran (Role)</label>
                    <select name="role" value={values.role} onChange={handleChange} className="input-field" disabled={isViewOnly}>
                      <option value="user">User</option>
                      <option value="officer">Petugas</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {/* Field lainnya hanya muncul jika SEDANG EDIT atau SEDANG LIHAT DETAIL */}
                  {(editingUser || isViewOnly) && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nama Lengkap</label>
                        <input name="fullName" value={values.fullName} onChange={handleChange} className="input-field" readOnly={isViewOnly} required />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Email</label>
                        <input type="email" name="email" value={values.email} onChange={handleChange} className="input-field" readOnly={isViewOnly} />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Departemen</label>
                        <input name="department" value={values.department} onChange={handleChange} className="input-field" readOnly={isViewOnly} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Jabatan</label>
                        <input name="position" value={values.position} onChange={handleChange} className="input-field" readOnly={isViewOnly} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="flex items-center">
                          <input type="checkbox" name="isActive" checked={values.isActive} onChange={(e) => setValues({ ...values, isActive: e.target.checked })} className="mr-2" disabled={isViewOnly} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Akun Aktif</span>
                        </label>
                      </div>
                    </>
                  )}

                  {/* Jika Menambah Pengguna Baru, berikan keterangan */}
                  {!editingUser && !isViewOnly && (
                    <div className="md:col-span-2 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl">
                      <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                        💡 Admin hanya perlu mendaftarkan <strong>NIP</strong> dan <strong>Peran</strong>. Data diri lainnya (Nama, Email, Password, dll) akan diisi sendiri oleh pengguna melalui halaman <strong>Aktivasi Akun</strong>.
                      </p>
                    </div>
                  )}
                </div>

                {!isViewOnly && (
                  <div className="mt-8 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Batal</button>
                    <button type="submit" className="btn-primary">
                      {editingUser ? 'Perbarui Pengguna' : 'Buat Pengguna'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;