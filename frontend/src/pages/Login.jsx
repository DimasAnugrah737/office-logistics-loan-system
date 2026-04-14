import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from '../hooks/useForm';
import { useAuth } from '../contexts/AuthContext';
import { FiMail, FiLock, FiSun, FiMoon, FiEye, FiEyeOff } from 'react-icons/fi';
import Logo from '../components/Logo';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, theme, toggleTheme } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [failedAttempts, setFailedAttempts] = React.useState(
    parseInt(localStorage.getItem('failedLoginAttempts') || '0', 10)
  );

  const handleFailedAttempt = () => {
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);
    localStorage.setItem('failedLoginAttempts', newAttempts.toString());
  };

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
    if (!values.identifier) errors.identifier = 'Email or Employee ID (NIP) is required';
    if (!values.password) errors.password = 'Password is required';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (failedAttempts >= 3) return;

    const validationErrors = validate(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await login(values);
      localStorage.removeItem('failedLoginAttempts');
      setFailedAttempts(0);
    } catch (error) {
      console.error('Login failed:', error);
      handleFailedAttempt();
      if (error.field) {
        setErrors({ [error.field]: error.message });
      } else {
        setErrors({ identifier: error.message || 'Login failed. Invalid credentials.' });
      }
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center min-h-screen w-full bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-800 rounded-none shadow-lg overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            {/* Kontainer untuk header dan tombol tema */}
            <div className="relative mb-8">
              {/* Tombol tema diposisikan absolut di pojok kanan atas untuk menjaga simetri */}
              <div className="absolute top-0 right-0">
                <button
                  type="button"
                  onClick={() => toggleTheme()}
                  className="p-2 rounded-none bg-gray-100 dark:bg-gray-700/50 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors border border-gray-200 dark:border-gray-600/50"
                  aria-label="Ganti tema"
                >
                  {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
                </button>
              </div>

              <div className="text-center">
                <div className="flex justify-center mb-8">
                  <div className="px-6 py-8 bg-gray-50 dark:bg-gray-700/30 rounded-none shadow-2xl border border-gray-100 dark:border-gray-700/50">
                    <Logo className="h-20 w-auto text-gray-900 dark:text-white" showText={true} />
                  </div>
                </div>
                <p className="mt-8 text-sm text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest">
                  Authentication Portal
                </p>
              </div>
            </div>

            {failedAttempts >= 3 && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-none text-center animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-red-700 dark:text-red-400 font-black text-sm uppercase tracking-wide">
                  Account Locked
                </p>
                <p className="text-red-600 dark:text-red-500 font-medium text-xs mt-1.5 leading-relaxed mb-3">
                  You have entered the wrong password 3 times. Please contact the Administrator immediately to reset your password.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('failedLoginAttempts');
                    setFailedAttempts(0);
                  }}
                  className="px-4 py-2 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  I have received my new password
                </button>
              </div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="identifier"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Email or Employee ID (NIP)
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
                    disabled={failedAttempts >= 3}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-none shadow-sm placeholder-gray-400 focus:outline-none focus:ring-theme-primary focus:border-theme-primary dark:bg-gray-700 dark:text-white sm:text-sm disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-all"
                    placeholder="Enter Email or Employee ID (NIP)"
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
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={values.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={failedAttempts >= 3}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-none shadow-sm placeholder-gray-400 focus:outline-none focus:ring-theme-primary focus:border-theme-primary dark:bg-gray-700 dark:text-white sm:text-sm disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500 disabled:cursor-not-allowed transition-all"
                    placeholder="Enter Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              <div className="flex flex-col space-y-4">
                <button
                  type="submit"
                  disabled={failedAttempts >= 3}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-none shadow-sm text-sm font-medium text-white bg-theme-primary hover:bg-theme-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-primary disabled:bg-gray-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-all"
                >
                  Login
                </button>

                <div className="text-center mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    First time here?{' '}
                    <button
                      type="button"
                      onClick={() => navigate('/activate')}
                      className="text-theme-primary font-bold hover:underline"
                    >
                      Activate account here
                    </button>
                  </p>
                </div>
              </div>
            </form>

            <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500 italic">
              * Ensure your Employee ID (NIP) has been registered by the Administrator before activation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;