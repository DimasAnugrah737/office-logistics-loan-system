import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainLayout from '../layouts/MainLayout';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import Users from '../pages/Users';
import Items from '../pages/Items';
import Categories from '../pages/Categories';
import Borrowings from '../pages/Borrowings';
import Reports from '../pages/Reports';
import ActivityLogs from '../pages/ActivityLogs';
import MyBorrowings from '../pages/MyBorrowings';
import BrowseItems from '../pages/BrowseItems';
import Notifications from '../pages/Notifications';
import ActivateAccount from '../pages/ActivateAccount';
import Profile from '../pages/Profile';

const PrivateRoute = ({ children, roles = [] }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<ActivateAccount />} />

      <Route path="/" element={<MainLayout />}>
        {/* Dashboard */}
        <Route
          path="dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* Admin only routes */}
        <Route
          path="users"
          element={
            <PrivateRoute roles={['admin', 'officer']}>
              <Users />
            </PrivateRoute>
          }
        />
        <Route
          path="categories"
          element={
            <PrivateRoute roles={['admin']}>
              <Categories />
            </PrivateRoute>
          }
        />
        <Route
          path="activity-logs"
          element={
            <PrivateRoute roles={['admin']}>
              <ActivityLogs />
            </PrivateRoute>
          }
        />

        {/* Admin and Officer routes */}
        <Route
          path="items"
          element={
            <PrivateRoute roles={['admin', 'officer']}>
              <Items />
            </PrivateRoute>
          }
        />
        <Route
          path="borrowings"
          element={
            <PrivateRoute roles={['admin', 'officer']}>
              <Borrowings />
            </PrivateRoute>
          }
        />
        <Route
          path="reports"
          element={
            <PrivateRoute roles={['admin', 'officer']}>
              <Reports />
            </PrivateRoute>
          }
        />

        {/* User routes */}
        <Route
          path="my-borrowings"
          element={
            <PrivateRoute roles={['user']}>
              <MyBorrowings />
            </PrivateRoute>
          }
        />
        <Route
          path="browse-items"
          element={
            <PrivateRoute roles={['user']}>
              <BrowseItems />
            </PrivateRoute>
          }
        />

        {/* Common routes */}
        <Route
          path="notifications"
          element={
            <PrivateRoute>
              <Notifications />
            </PrivateRoute>
          }
        />
        <Route
          path="profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />

        {/* Redirect root to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;