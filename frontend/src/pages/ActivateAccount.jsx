import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import { FiUser, FiInfo, FiMail, FiLock, FiPhone, FiBriefcase, FiArrowRight, FiCheckCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import toast from 'react-hot-toast';

/**
 * Komponen ActivateAccount
 * Digunakan oleh pengguna baru untuk mengaktifkan akun mereka menggunakan NIP yang sudah didaftarkan admin.
 */
const ActivateAccount = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // Langkah 1: Cek NIP, Langkah 2: Isi Detail Profil
    const [loading, setLoading] = useState(false);
    const [nip, setNip] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [userRole, setUserRole] = useState(''); // Menyimpan peran user yang didapat dari server
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        department: '',
        position: '',
        phone: '',
    });
    const [errors, setErrors] = useState({});

    /**
     * Memeriksa apakah NIP sudah terdaftar dan siap diaktivasi
     */
    const handleCheckNip = async (e) => {
        e.preventDefault();
        if (!nip) return toast.error('Please enter your NIP');

        setLoading(true);
        try {
            const response = await authAPI.checkActivation({ nip });
            if (response.success) {
                setUserRole(response.role);
                setStep(2);
                toast.success('Verification successful, please complete your data.');
            }
        } catch (error) {
            console.error('NIP Verification Error:', error);
            const message = error.message || 'Failed to verify NIP';
            
            // Jika akun sudah aktif, arahkan ke halaman login
            if (error.alreadyActivated || message.toLowerCase().includes('sudah diaktivasi')) {
                toast.error('This NIP is already active. Redirecting to login...');
                setTimeout(() => navigate('/login'), 2000);
                return;
            }
            
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Menangani perubahan input form
     */
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (errors[name]) {
            const newErrors = { ...errors };
            delete newErrors[name];
            setErrors(newErrors);
        }
    };

    /**
     * Mengirim data aktivasi ke server
     */
    const handleActivate = async (e) => {
        e.preventDefault();

        // Validasi input
        const newErrors = {};
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Password confirmation does not match';
        }
        if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setErrors({});

        setErrors({});
        setLoading(true);
        try {
            const dataToSubmit = {
                nip,
                ...formData
            };
            // Logika khusus jika akun adalah akun Departemen/Unit (Officer)
            if (userRole === 'officer') {
                dataToSubmit.department = formData.fullName;
                dataToSubmit.position = 'Department Account'; 
            }
            await authAPI.activateAccount(dataToSubmit);
            toast.success('Account activated successfully! Please login.');
            navigate('/login');
        } catch (error) {
            console.log('DEBUG: Full error object:', error);
            console.error('Activation Error:', error);
            if (error.field) {
                setErrors({ [error.field]: error.message });
            } else {
                toast.error(error.message || 'Failed to activate account');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white dark:bg-slate-800 rounded-none shadow-xl shadow-theme-primary/5 p-8 border border-gray-100 dark:border-slate-700">
                    <div className="text-center mb-8">
                        <div className="inline-flex p-3 rounded-none bg-theme-primary-light mb-4">
                            <FiCheckCircle className="h-8 w-8 text-theme-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Activation</h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            {step === 1
                                ? 'Enter your NIP to start activation'
                                : 'Complete profile to activate your account'}
                        </p>
                    </div>

                    {step === 1 ? (
                        // Form Langkah 1: Input NIP
                        <form onSubmit={handleCheckNip} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Employee Identification Number (NIP)</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-theme-primary transition-colors">
                                        <FiUser size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={nip}
                                        onChange={(e) => setNip(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50/50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-none outline-none focus:ring-2 focus:ring-theme-primary/20 focus:border-theme-primary dark:text-white transition-all text-sm font-medium"
                                        placeholder="e.g. 19930112..."
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 px-6 bg-theme-primary hover:bg-theme-primary text-white rounded-none font-bold text-sm shadow-lg shadow-theme-primary/20 transition-all flex items-center justify-center gap-2 group"
                            >
                                {loading ? 'Checking...' : 'Check NIP'}
                                <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </form>
                    ) : (
                        // Form Langkah 2: Lengkapi Data
                        <form onSubmit={handleActivate} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-none">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    {userRole === 'officer' ? 'Unit/Department Name' : 'Full Name'}
                                </label>
                                <div className="relative">
                                    <FiUser className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        className="input-field pl-10"
                                        placeholder={userRole === 'officer' ? 'Enter department name' : 'Enter full name'}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Office Email</label>
                                <div className="relative">
                                    <FiMail className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="input-field pl-10"
                                        placeholder="email@office.com"
                                        required
                                    />
                                </div>
                                {errors.email && (
                                    <p className="mt-1 text-xs text-red-600 font-bold italic">* {errors.email}</p>
                                )}
                            </div>

                            <div className={`grid grid-cols-1 ${userRole !== 'officer' ? 'md:grid-cols-2' : ''} gap-3`}>
                                {userRole !== 'officer' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Department</label>
                                        <input
                                            name="department"
                                            value={formData.department}
                                            onChange={handleChange}
                                            className="input-field text-sm"
                                            placeholder="e.g. IT"
                                            required
                                        />
                                    </div>
                                )}
                                {userRole !== 'officer' && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Position</label>
                                        <input
                                            name="position"
                                            value={formData.position}
                                            onChange={handleChange}
                                            className="input-field text-sm"
                                            placeholder="e.g. Staff"
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    {userRole === 'officer' ? 'Unit Contact Number' : 'WhatsApp/Phone Number'}
                                </label>
                                <div className="relative">
                                    <FiPhone className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="input-field pl-10"
                                        placeholder="0812..."
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 pt-2 border-t dark:border-slate-700">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">New Password</label>
                                <div className="relative">
                                    <FiLock className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="input-field pl-10 pr-10"
                                        placeholder="Min. 6 characters"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="mt-1 text-xs text-red-600 font-bold italic">* {errors.password}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Confirm Password</label>
                                <div className="relative">
                                    <FiLock className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className="input-field pl-10 pr-10"
                                        placeholder="Repeat password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                    </button>
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1 text-xs text-red-600 font-bold italic">* {errors.confirmPassword}</p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-none font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all"
                            >
                                {loading ? 'Processing...' : 'Activate Account Now'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                Back to NIP verification
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center pt-6 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            Already have an account?{' '}
                            <Link to="/login" className="text-theme-primary font-bold hover:underline">
                                Login here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivateAccount;

