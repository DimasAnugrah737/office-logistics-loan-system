import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/auth';
import toast from 'react-hot-toast';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    checkAuth();
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const userData = await authAPI.getCurrentUser();
      setUser(userData);

      // Set theme from user preference
      if (userData.themePreference && userData.themePreference !== theme) {
        toggleTheme(userData.themePreference);
      }
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response));
      setUser(response);

      // Update theme based on user preference
      if (response.themePreference && response.themePreference !== theme) {
        toggleTheme(response.themePreference);
      }

      toast.success('Login successful!');
      return response;
    } catch (error) {
      toast.error(error.message || 'Login failed');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      toast.success('Logged out successfully');
      window.location.href = '/login';
    }
  };

  const toggleTheme = (newTheme) => {
    const themeToSet = newTheme || (theme === 'light' ? 'dark' : 'light');
    setTheme(themeToSet);
    localStorage.setItem('theme', themeToSet);
    document.documentElement.classList.toggle('dark', themeToSet === 'dark');

    // Update theme preference in backend if user is logged in
    if (user) {
      authAPI.updateTheme(themeToSet).catch(console.error);
    }
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        theme,
        login,
        logout,
        toggleTheme,
        updateUser,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isOfficer: user?.role === 'officer',
        isRegularUser: user?.role === 'user',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};