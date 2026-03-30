import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import { FiUser, FiInfo, FiMail, FiLock, FiPhone, FiBriefcase, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const ActivateAccount = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Check NIP, 2: Fill Details
    const [loading, setLoading] = useState(false);
    const [nip, setNip] = useState('');
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        department: '',
        position: '',
        phone: '',
    });

    const handleCheckNip = async (e) => {
        e.preventDefault();
        if (!nip) return toast.error('Silakan masukkan NIP');

        setLoading(true);
        try {
            const response = await authAPI.checkActivation({ nip });
            if (response.success) {
                setStep(2);
                toast.success('NIP terverifikasi, silakan lengkapi data diri.');
            }
        } catch (error) {
            console.error('NIP Verification Error:', error);
            const message = error.message || 'Gagal memverifikasi NIP';
            
            // If already activated, show success-like toast but it's an error flow
            if (error.alreadyActivated || message.toLowerCase().includes('sudah diaktivasi')) {
                toast.error('NIP ini sudah aktif. Mengalihkan ke halaman login...');
                setTimeout(() => navigate('/login'), 2000);
                return;
            }
            
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleActivate = async (e) => {
        e.preventDefault();

        // Validation
        if (formData.password !== formData.confirmPassword) {
            return toast.error('Konfirmasi password tidak cocok');
        }
        if (formData.password.length < 6) {
            return toast.error('Password minimal 6 karakter');
        }

        setLoading(true);
        try {
            await authAPI.activateAccount({
                nip,
                ...formData
            });
            toast.success('Akun berhasil diaktivasi! Silakan login.');
            navigate('/login');
        } catch (error) {
            toast.error(error.message || 'Gagal aktivasi akun');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-primary-500/5 p-8 border border-gray-100 dark:border-slate-700">
                    <div className="text-center mb-8">
                        <div className="inline-flex p-3 rounded-2xl bg-primary-50 dark:bg-primary-900/20 mb-4">
                            <FiCheckCircle className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Aktivasi Akun</h1>
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            {step === 1
                                ? 'Masukkan NIP Anda untuk memulai aktivasi'
                                : 'Lengkapi data profil Anda untuk mengaktifkan akun'}
                        </p>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={handleCheckNip} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Nomor Induk Pegawai (NIP)</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary-500 transition-colors">
                                        <FiUser size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={nip}
                                        onChange={(e) => setNip(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50/50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:text-white transition-all text-sm font-medium"
                                        placeholder="Contoh: 19930112..."
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary-500/25 transition-all flex items-center justify-center gap-2 group"
                            >
                                {loading ? 'Mengecek...' : 'Cek NIP'}
                                <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleActivate} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-none">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nama Lengkap</label>
                                <div className="relative">
                                    <FiUser className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        className="input-field pl-10"
                                        placeholder="Masukkan nama lengkap"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Kantor</label>
                                <div className="relative">
                                    <FiMail className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="input-field pl-10"
                                        placeholder="email@perusahaan.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Departemen</label>
                                    <input
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        className="input-field text-sm"
                                        placeholder="Ex: IT"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Jabatan</label>
                                    <input
                                        name="position"
                                        value={formData.position}
                                        onChange={handleChange}
                                        className="input-field text-sm"
                                        placeholder="Ex: Staff"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nomor WA/HP</label>
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
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Password Baru</label>
                                <div className="relative">
                                    <FiLock className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        className="input-field pl-10"
                                        placeholder="Min. 6 karakter"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Konfirmasi Password</label>
                                <div className="relative">
                                    <FiLock className="absolute left-3 top-3.5 text-gray-400" />
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        className="input-field pl-10"
                                        placeholder="Ulangi password"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3.5 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all"
                            >
                                {loading ? 'Memproses...' : 'Aktifkan Akun Sekarang'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                Kembali ke verifikasi NIP
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center pt-6 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                            Sudah punya akun?{' '}
                            <Link to="/login" className="text-primary-600 dark:text-primary-400 font-bold hover:underline">
                                Login di sini
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActivateAccount;
