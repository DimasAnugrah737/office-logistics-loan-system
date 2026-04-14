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
import ConfirmationModal from '../components/ConfirmationModal';

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  
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

  const [errors, setErrors] = useState({});

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData({ ...profileData, [name]: value });
    if (errors[name]) {
      const newErrors = { ...errors };
      delete newErrors[name];
      setErrors(newErrors);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({ ...passwordData, [name]: value });
    if (errors[name]) {
       const newErrors = { ...errors };
       delete newErrors[name];
       setErrors(newErrors);
    }
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    setIsProfileModalOpen(true);
  };

  const confirmUpdateProfile = async () => {
    setErrors({});
    setLoading(true);
    try {
      const updatedUser = await authAPI.updateProfile(profileData);
      updateUser(updatedUser);
      toast.success('Profile updated successfully');
    } catch (error) {
      if (error.field) {
        setErrors({ [error.field]: error.message });
      } else {
        toast.error(error.message || 'Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    
    // Validasi input
    const newErrors = {};
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Password confirmation does not match';
    }
    
    if (passwordData.newPassword.length < 6) {
      newErrors.newPassword = 'New password must be at least 6 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsPasswordModalOpen(true);
  };

  const confirmChangePassword = async () => {
    setErrors({});
    setLoading(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      if (error.field) {
        setErrors({ [error.field]: error.message });
      } else {
        toast.error(error.message || 'Failed to update password');
      }
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
            className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-none text-gray-400 hover:text-theme-primary hover:border-theme-primary/20 transition-all shadow-sm group"
            title="Back to Dashboard"
          >
            <FiArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Account Settings</h1>
            <p className="text-xs sm:text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">Manage your profile and data security</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-theme-primary-light px-4 py-2 rounded-none border border-theme-primary/20">
          <FiShield className="text-theme-primary" size={18} />
          <span className="text-[10px] font-black text-theme-primary uppercase tracking-widest">Verified Account</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
        {/* Ringkasan Info Profil (Sticky di kiri pada tampilan desktop) */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-none p-8 border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/20 dark:shadow-none sticky top-24">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-theme-primary-light rounded-none flex items-center justify-center text-theme-primary mb-6 shadow-inner relative group">
                <FiUser size={48} className="sm:size-[64px]" />
                <div className="absolute inset-0 bg-theme-primary/10 rounded-none opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter truncate w-full">{user?.fullName}</h2>
              <p className="text-[10px] font-black text-theme-primary uppercase tracking-widest mt-1">{user?.role === 'admin' ? 'Administrator' : user?.role === 'officer' ? 'Inventory Officer' : 'Employee'}</p>
              
              <div className="w-full h-px bg-gray-100 dark:bg-gray-700 my-6" />
              
              <div className="w-full space-y-4 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-none bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">
                    <FiMail size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Email</p>
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate">{user?.email || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-none bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">
                    <FiBriefcase size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Email/Agency</p>
                    <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate">{user?.department} • {user?.position}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Pengeditan */}
        <div className="lg:col-span-2 space-y-8 sm:space-y-12">
          {/* Bagian Edit Profil */}
          <section className="bg-white dark:bg-gray-800 rounded-none overflow-hidden border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none">
            <div className="p-6 sm:p-10 border-b border-gray-50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-none bg-theme-primary text-white flex items-center justify-center shadow-lg shadow-theme-primary/20">
                  <FiUser size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Personal Data</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Basic Account Information</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative group">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-theme-primary transition-colors" size={18} />
                    <input
                      name="fullName"
                      value={profileData.fullName}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-none outline-none focus:ring-4 focus:ring-theme-primary/10 focus:border-theme-primary dark:text-white transition-all text-sm font-bold"
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Office Email</label>
                  <div className="relative group">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-theme-primary transition-colors" size={18} />
                    <input
                      type="email"
                      name="email"
                      value={profileData.email}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-none outline-none focus:ring-4 focus:ring-theme-primary/10 focus:border-theme-primary dark:text-white transition-all text-sm font-bold"
                      placeholder="email@office.com"
                      required
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600 font-bold italic">* {errors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Department</label>
                  <div className="relative group">
                    <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-theme-primary transition-colors" size={18} />
                    <input
                      name="department"
                      value={profileData.department}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-none outline-none focus:ring-4 focus:ring-theme-primary/10 focus:border-theme-primary dark:text-white transition-all text-sm font-bold"
                      placeholder="e.g. IT Support"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Position</label>
                  <div className="relative group">
                    <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-theme-primary transition-colors" size={18} />
                    <input
                      name="position"
                      value={profileData.position}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-none outline-none focus:ring-4 focus:ring-theme-primary/10 focus:border-theme-primary dark:text-white transition-all text-sm font-bold"
                      placeholder="e.g. Senior Staff"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">WhatsApp/Phone Number</label>
                  <div className="relative group">
                    <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-theme-primary transition-colors" size={18} />
                    <input
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileChange}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-none outline-none focus:ring-4 focus:ring-theme-primary/10 focus:border-theme-primary dark:text-white transition-all text-sm font-bold"
                      placeholder="0812345..."
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-3.5 bg-theme-primary hover:bg-theme-primary text-white rounded-none font-black text-xs uppercase tracking-widest shadow-lg shadow-theme-primary/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  <FiSave size={18} />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>

          {/* Bagian Keamanan / Password */}
          <section className="bg-white dark:bg-gray-800 rounded-none overflow-hidden border border-gray-100 dark:border-gray-700 shadow-xl shadow-gray-200/10 dark:shadow-none">
            <div className="p-6 sm:p-10 border-b border-gray-50 dark:border-gray-700/50 bg-red-50/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-none bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                  <FiLock size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">Security</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Update Your Password</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handleChangePassword} className="p-6 sm:p-10 space-y-6 sm:space-y-8">
              <div className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Current Password</label>
                  <div className="relative group">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-none outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 dark:text-white transition-all text-sm font-bold"
                      placeholder="Enter current password"
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
                  {errors.currentPassword && (
                    <p className="mt-1 text-xs text-red-600 font-bold italic">* {errors.currentPassword}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">New Password</label>
                    <div className="relative group">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type={showNewPassword ? "text" : "password"}
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-none outline-none focus:ring-4 focus:ring-theme-primary/10 focus:border-theme-primary dark:text-white transition-all text-sm font-bold"
                        placeholder="Min. 6 characters"
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
                    {errors.newPassword && (
                      <p className="mt-1 text-xs text-red-600 font-bold italic">* {errors.newPassword}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Confirm Password</label>
                    <div className="relative group">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full pl-12 pr-12 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-none outline-none focus:ring-4 focus:ring-theme-primary/10 focus:border-theme-primary dark:text-white transition-all text-sm font-bold"
                        placeholder="Repeat new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1 text-xs text-red-600 font-bold italic">* {errors.confirmPassword}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-none font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  <FiLock size={18} />
                  {loading ? 'Processing...' : 'Update Password'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>

      <ConfirmationModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onConfirm={confirmUpdateProfile}
        title="Save Profile Changes"
        message="Are you sure you want to update your profile data?"
        confirmText="Save"
        type="primary"
        icon={FiSave}
      />

      <ConfirmationModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={confirmChangePassword}
        title="Change Password"
        message="Are you sure you want to change your password? You will need to use the new password for your next login."
        confirmText="Change Password"
        type="danger"
        icon={FiLock}
      />
    </div>
  );
};

export default Profile;
