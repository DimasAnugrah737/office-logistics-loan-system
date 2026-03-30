import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../api/auth';
import { 
  FiUser, 
  FiMail, 
  FiLock, 
  FiPhone, 
  FiBriefcase, 
  FiShield, 
  FiSave,
  FiEye,
  FiEyeOff,
  FiArrowLeft
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    department: user?.department || '',
    position: user?.position || '',
    phone: user?.phone || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updatedUser = await authAPI.updateProfile(profileData);
      updateUser(updatedUser);
      toast.success('Profil berhasil diperbarui');
    } catch (error) {
      toast.error(error.message || 'Gagal memperbarui profil');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('Konfirmasi password tidak cocok');
    }
    
    if (passwordData.newPassword.length < 6) {
      return toast.error('Password baru minimal 6 karakter');
    }

    setLoading(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password berhasil diperbarui');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      toast.error(error.message || 'Gagal memperbarui password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl text-gray-400 hover:text-primary-600 hover:border-primary-100 transition-all shadow-sm group"
            title="Kembali ke Dashboard"
          >
            <FiArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Pengaturan Akun</h1>
            <p className="text-xs sm:text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">Kelola profil dan keamanan data Anda</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-4 py-2 rounded-2xl border border-primary-100 dark:border-primary-900/30">
          <FiShield className="text-primary-600" size={18} />
          <span className="text-[10px] font-black text-primary-700 dark:text-primary-400 uppercase tracking-widest">Akun Terverifikasi</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
        {/* Profile Info Summary (Sticky Left on desktop) */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none sticky top-24">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-primary-100 dark:bg-primary-900/30 rounded-[2rem] flex items-center justify-center text-primary-600 mb-6 shadow-inner relative group">
                <FiUser size={48} className="sm:size-[64px]" />
                <div className="absolute inset-0 bg-primary-600/10 rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter truncate w-full">{user?.fullName}</h2>
              <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mt-1">{user?.role === 'admin' ? 'Administrator' : user?.role === 'officer' ? 'Petugas Inventaris' : 'Pegawai'}</p>
              
              <div className="w-full h-px bg-gray-100 dark:bg-gray-700 my-6" />
              
              <div className="w-full space-y-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">
                    <FiMail size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Email</p>
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate">{user?.email || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">
                    <FiBriefcase size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Instansi</p>
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate">{user?.department} • {user?.position}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Forms */}
        <div className="lg:col-span-2 space-y-8 sm:space-y-12">
          {/* Profile Edit Section */}
          <section className="bg-white dark:bg-gray-800 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none">
            <div className="p-6 sm:p-10 border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <FiUser size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Biodata Diri</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Informasi Dasar Akun</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <div className="relative group">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input
                      name="fullName"
                      value={profileData.fullName}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:text-white transition-all text-sm font-bold"
                      placeholder="Masukkan nama lengkap"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Kantor</label>
                  <div className="relative group">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:text-white transition-all text-sm font-bold"
                      placeholder="email@kantor.com"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Departemen</label>
                  <div className="relative group">
                    <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input
                      name="department"
                      value={profileData.department}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:text-white transition-all text-sm font-bold"
                      placeholder="Contoh: IT Support"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Jabatan</label>
                  <div className="relative group">
                    <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input
                      name="position"
                      value={profileData.position}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:text-white transition-all text-sm font-bold"
                      placeholder="Contoh: Staff Utama"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nomor WA/HP</label>
                  <div className="relative group">
                    <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                    <input
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:text-white transition-all text-sm font-bold"
                      placeholder="0812345..."
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary-500/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  <FiSave size={18} />
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </section>

          {/* Security / Password Section */}
          <section className="bg-white dark:bg-gray-800 rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none">
            <div className="p-6 sm:p-10 border-b border-gray-50 dark:border-gray-700/50 bg-red-50/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                  <FiLock size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Keamanan</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Perbarui Kata Sandi Anda</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleChangePassword} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
              <div className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password Saat Ini</label>
                  <div className="relative group">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 dark:text-white transition-all text-sm font-bold"
                      placeholder="Masukkan password lama"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password Baru</label>
                    <div className="relative group">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:text-white transition-all text-sm font-bold"
                        placeholder="Min. 6 karakter"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Konfirmasi Password</label>
                    <div className="relative group">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-2xl outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 dark:text-white transition-all text-sm font-bold"
                        placeholder="Ulangi password baru"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  <FiLock size={18} />
                  {loading ? 'Memproses...' : 'Ubah Password'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;
