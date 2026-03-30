import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from '../hooks/useForm';
import { useAuth } from '../contexts/AuthContext';
import { FiMail, FiLock, FiSun, FiMoon } from 'react-icons/fi';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, theme, toggleTheme } = useAuth();

  const { values, errors, handleChange, handleBlur, setErrors } = useForm({
    identifier: '',
    password: '',
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const validate = (values) => {
    const errors = {};
    if (!values.identifier) errors.identifier = 'Email or NIP is required';
    if (!values.password) errors.password = 'Password is required';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await login(values);
    } catch (error) {
      console.error('Login failed:', error);
      if (error.field) {
        setErrors({ [error.field]: error.message });
      }
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center min-h-screen w-full bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            {/* Container untuk header dan tombol tema */}
            <div className="relative mb-8">
              {/* Tombol tema di pojok kanan atas secara absolut agar tidak merusak simetri */}
              <div className="absolute top-0 right-0">
                <button
                  type="button"
                  onClick={() => toggleTheme()}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700/50 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors border border-gray-200 dark:border-gray-600/50"
                  aria-label="Toggle theme"
                >
                  {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
                </button>
              </div>

              <div className="text-center">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 bg-primary-50 dark:bg-primary-900/30 rounded-3xl flex items-center justify-center p-4 shadow-xl border border-primary-100 dark:border-primary-800/50 animate-bounce-slow">
                    <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">
                  Office <span className="text-primary-600">Equipment</span>
                </h2>
                <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mt-1">
                  Management System
                </p>
                <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Masuk ke akun anda
                </p>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email atau NIP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiMail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    value={values.identifier}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    placeholder="Masukan Email atau NIP"
                  />
                </div>
                {errors.identifier && (
                  <p className="mt-1 text-sm text-red-600">{errors.identifier}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiLock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={values.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white sm:text-sm"
                    placeholder="Masukan Password"
                  />
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div className="flex flex-col space-y-4">
                <button
                  type="submit"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Masuk
                </button>

                <div className="text-center mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Baru pertama kali?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/activate')}
                      className="text-primary-600 dark:text-primary-400 font-bold hover:underline"
                    >
                      Aktivasi Akun di sini
                    </button>
                  </p>
                </div>
              </div>
            </form>

            <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500 italic">
              * Pastikan NIP Anda sudah didaftarkan oleh Administrator sebelum melakukan aktivasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;