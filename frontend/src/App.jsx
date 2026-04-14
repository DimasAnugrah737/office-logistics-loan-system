import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { SocketProvider } from './contexts/SocketContext';
import AppRoutes from './routes';

/**
 * React Query Client configuration for server state management.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Do not refetch data when the browser window gains focus
      refetchOnWindowFocus: false,
      // Retry once if the request fails
      retry: 1,
    },
  },
});

/**
 * Main Application Component.
 * Here we wrap the application with various Providers for global state.
 */
function App() {
  return (
    // Provider for React Query
    <QueryClientProvider client={queryClient}>
      {/* Provider for Routing (React Router) */}
      <BrowserRouter>
        {/* Provider for User Authentication */}
        <AuthProvider>
          {/* Provider for Real-time Communication (Socket.io) */}
          <SocketProvider>
            {/* Provider for System Notifications */}
            <NotificationProvider>
              {/* Definition of All Application Routes */}
              <AppRoutes />
              
              {/* Component to display Toast messages (small notifications) */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#333',
                    color: '#fff',
                    borderRadius: '0px',
                  },
                  success: {
                    duration: 3000,
                    theme: {
                      primary: 'green',
                      secondary: 'black',
                    },
                  },
                }}
              />
            </NotificationProvider>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;