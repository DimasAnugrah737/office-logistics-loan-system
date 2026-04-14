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
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [userToReset, setUserToReset] = useState(null);
  const [resetSuccessData, setResetSuccessData] = useState(null);

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
      // Menangani format array lama dan format objek paginasi baru
      if (data && data.users) {
        setUsers(data.users);
      } else if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
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
      filtered = filtered.filter(user =>
        (user.fullName?.toLowerCase().includes(term)) ||
        (user.nip?.toLowerCase().includes(term)) ||
        (user.email?.toLowerCase().includes(term))
      );
    }
    if (filterRole !== 'all') filtered = filtered.filter(user => user.role === filterRole);
    setFilteredUsers(filtered);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitModalOpen(true);
  };

  const confirmSubmit = async () => {
    try {
      if (editingUser) {
        const { password, ...updateData } = values;
        if (!password) delete updateData.password;
        if (values.role === 'officer') updateData.department = values.fullName;
        await updateUser(editingUser.id, updateData);
        toast.success('User updated successfully');
      } else {
        const createData = { ...values };
        if (values.role === 'officer') createData.department = values.fullName;
        await createUser(createData);
        toast.success('User added successfully');
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to process user data');
    } finally {
      setIsSubmitModalOpen(false);
    }
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
      toast.success('User deleted successfully');
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
      const response = await resetPassword(userToReset.id);
      const tempPass = response?.tempPassword || 'Check console';
      setResetSuccessData({
        user: userToReset,
        tempPass
      });
      toast.success('Password successfully reset');
    } catch (error) {
      toast.error('Failed to reset password');
    } finally {
      setIsResetModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Users</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">Manage system users and permissions</p>
        </div>
        {canManageUsers && (
          <div className="flex gap-2">
            <button
              onClick={() => { setIsViewOnly(false); setEditingUser(null); resetForm(); setValues(prev => ({ ...prev, role: 'officer' })); setIsModalOpen(true); }}
              className="btn-primary"
            >
              <FiUserPlus className="mr-2" /> Add Unit/Department
            </button>
            <button
              onClick={() => { setIsViewOnly(false); setEditingUser(null); resetForm(); setValues(prev => ({ ...prev, role: 'user' })); setIsModalOpen(true); }}
              className="btn-primary"
            >
              <FiUserPlus className="mr-2" /> Add User
            </button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800/50 rounded-none shadow-xl shadow-gray-200/10 dark:shadow-none border border-gray-100 dark:border-slate-800 p-2 sm:p-3 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-8 relative group rounded-none border border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 focus-within:border-theme-primary/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-theme-primary/5 transition-all duration-300">
            <label className="text-[8px] font-black text-theme-primary uppercase tracking-[0.2em] absolute top-2.5 left-11 z-10 group-focus-within:text-theme-primary">Search</label>
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary h-5 w-5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, NIP, or Email..."
              className="w-full pl-11 pr-4 pt-6 pb-2.5 bg-transparent outline-none text-[11px] font-bold dark:text-white placeholder-gray-300"
            />
          </div>
          <div className="md:col-span-4 relative group rounded-none border border-gray-50 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/30 focus-within:border-theme-primary/50 focus-within:bg-white dark:focus-within:bg-slate-800 focus-within:ring-4 focus-within:ring-theme-primary/5 transition-all duration-300">
            <label className="text-[8px] font-black text-theme-primary uppercase tracking-[0.2em] absolute top-2.5 left-11 z-10 group-focus-within:text-theme-primary">Role</label>
            <FiUsers className="absolute left-4 top-1/2 -translate-y-1/2 text-theme-primary h-4 w-4" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full pl-11 pr-8 pt-6 pb-2.5 bg-transparent outline-none text-[11px] font-bold uppercase tracking-wider appearance-none dark:text-white cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="admin">Administrator</option>
              <option value="officer">Officer</option>
              <option value="user">User</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="table-header">User</th>
                <th className="table-header">NIP</th>
                <th className="table-header">Role</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="table-cell">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-none bg-theme-primary-light flex items-center justify-center border border-theme-primary/20">
                        <span className="text-sm font-bold text-theme-primary">{user.fullName ? user.fullName.charAt(0) : '?'}</span>
                      </div>
                      <div className="ml-3 font-medium text-gray-900 dark:text-white">{user.fullName}</div>
                    </div>
                  </td>
                  <td className="table-cell font-mono text-xs">{user.nip}</td>
                  <td className="table-cell">
                    <span className="px-2 py-0.5 rounded-none text-[10px] font-bold uppercase bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-slate-700">
                      {user.role === 'admin' ? 'Admin' : user.role === 'officer' ? 'Officer' : 'User'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold uppercase ${user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>{user.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleView(user)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-none"><FiEye size={18} /></button>
                      {canManageUsers && (
                        <>
                          {isAdmin && (
                            <button onClick={() => handleResetPasswordClick(user)} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-none" title="Reset Password"><FiKey size={18} /></button>
                          )}
                          <button onClick={() => handleEdit(user)} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none"><FiEdit2 size={18} /></button>
                          {user.role !== 'admin' && (
                            <button onClick={() => handleDeleteClick(user)} className="p-1.5 text-theme-primary hover:bg-theme-primary-light rounded-none"><FiTrash2 size={18} /></button>
                          )}
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
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onConfirm={confirmSubmit}
        title={editingUser ? "Update User" : "Add User"}
        message={`Are you sure you want to ${editingUser ? 'update' : 'add'} this user?`}
        confirmText={editingUser ? "Update" : "Save"}
        type="primary"
        icon={editingUser ? FiEdit2 : FiUserPlus}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete User"
        message="Are you sure you want to delete this user?"
        confirmText="Delete"
        type="danger"
        icon={FiTrash2}
      />

      <ConfirmationModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={confirmResetPassword}
        title="Reset User Password"
        message={`Are you sure you want to reset password for user ${userToReset?.fullName || userToReset?.nip}? Password will be set to a temporary random string.`}
        confirmText="Reset"
        type="warning"
        icon={FiKey}
      />

      {/* Prominent Reset Password Success Modal */}
      {resetSuccessData && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-none shadow-2xl max-w-sm w-full border border-green-500/30 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-green-50 dark:bg-green-900/20 p-6 text-center border-b border-green-100 dark:border-green-800/50">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiKey className="text-green-600 dark:text-green-400" size={32} />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Access Granted</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                Password for <strong className="text-theme-primary">{resetSuccessData.user.fullName || resetSuccessData.user.nip}</strong> has been successfully reset.
              </p>
            </div>
            <div className="p-6">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-center">New Temporary Password</label>
              <div className="bg-gray-50 dark:bg-slate-900 p-4 border border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center cursor-copy select-all">
                <code className="text-2xl font-mono font-bold text-rose-600 dark:text-rose-400 tracking-wider">
                  {resetSuccessData.tempPass}
                </code>
              </div>
              <p className="text-[10px] text-center text-gray-400 mt-4 italic">
                Silakan copy dan berikan password ini kepada pengguna terkait.
              </p>
            </div>
            <div className="p-4 border-t border-gray-50 dark:border-slate-700">
              <button
                onClick={() => setResetSuccessData(null)}
                className="w-full py-3 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors rounded-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsModalOpen(false)} />
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-none px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-xl sm:w-full sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isViewOnly ? 'User Details' : editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500"><FiX size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Role Indicator - Clear and Visual */}
                  <div className="md:col-span-2">
                    <div className={`px-4 py-3 rounded-none border flex items-center justify-between ${values.role === 'officer' ? 'bg-green-50 border-green-100 text-green-700' : values.role === 'admin' ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-none ${values.role === 'officer' ? 'bg-green-500' : values.role === 'admin' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">Role Registration: {values.role === 'admin' ? 'Administrator' : values.role === 'officer' ? 'Officer (Unit/Section)' : 'Regular User'}</span>
                      </div>
                      {editingUser && <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">ID: {editingUser.id}</span>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                      {values.role === 'officer' ? 'Unit Code / ID' : 'NIP / User ID'}
                    </label>
                    <input name="nip" value={values.nip} onChange={handleChange} className="input-field" readOnly={isViewOnly} required placeholder={values.role === 'officer' ? 'e.g. UNIT-IT' : 'NIP'} />
                  </div>

                  {/* Show Name for Officer during creation too */}
                  <div className={values.role === 'officer' ? 'md:col-span-2' : ''}>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                      {values.role === 'officer' ? 'Unit / Department Name' : 'Full Name'}
                    </label>
                    {(!editingUser && !isViewOnly && values.role !== 'officer') ? (
                      <div className="input-field bg-gray-50 text-gray-400 italic">Filled by user during activation</div>
                    ) : (
                      <input name="fullName" value={values.fullName} onChange={handleChange} className="input-field" readOnly={isViewOnly} required placeholder={values.role === 'officer' ? 'e.g. Information Technology' : 'Full Name'} />
                    )}
                  </div>

                  {/* Other fields only for viewing/editing or specific roles */}
                  {(editingUser || isViewOnly) && (
                    <>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Email</label>
                        <input type="email" name="email" value={values.email} onChange={handleChange} className="input-field" readOnly={isViewOnly} />
                      </div>

                      {values.role !== 'officer' && (
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Unit/Department</label>
                          <input name="department" value={values.department} onChange={handleChange} className="input-field" readOnly={isViewOnly} />
                        </div>
                      )}

                      {values.role !== 'officer' && (
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Position</label>
                          <input name="position" value={values.position} onChange={handleChange} className="input-field" readOnly={isViewOnly} />
                        </div>
                      )}

                      <div className="md:col-span-2">
                        <label className="flex items-center group cursor-pointer">
                          <input type="checkbox" name="isActive" checked={values.isActive} onChange={(e) => setValues({ ...values, isActive: e.target.checked })} className="w-4 h-4 rounded-none border-gray-300 text-theme-primary focus:ring-theme-primary" disabled={isViewOnly} />
                          <span className="ml-3 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">Account Status Active</span>
                        </label>
                      </div>
                    </>
                  )}

                  {/* Tip block */}
                  {!editingUser && !isViewOnly && (
                    <div className="md:col-span-2 p-5 bg-primary-50/50 dark:bg-primary-900/10 border border-primary-100/50 dark:border-primary-800 rounded-none">
                      <p className="text-[10px] text-primary-600 dark:text-primary-400 font-bold leading-relaxed uppercase tracking-wider">
                        {values.role === 'officer' ? (
                          <>💡 FOR OFFICER: Please register Unit/Department identity. This name will appear in inventory as item manager.</>
                        ) : (
                          <>💡 FOR USER: Just register NIP. Name and Password will be set by user during first login.</>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {!isViewOnly && (
                  <div className="mt-8 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                    <button type="submit" className="btn-primary">
                      {editingUser ? 'Update User' : 'Save User'}
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