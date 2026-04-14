import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { WS_URL } from '../api/axiosConfig';

const SocketContext = createContext(null);

export const useSocket = () => {
    return useContext(SocketContext);
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const { user, updateUser } = useAuth();

    useEffect(() => {
        if (!user) return;

        const newSocket = io(WS_URL, {
            transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
            console.log('Socket connected:', newSocket.id);
            newSocket.emit('authenticate', user.id);
        });

        newSocket.on('notification', (data) => {
            console.log('Real-time notification:', data);

            if (data.type === 'borrow_approved') {
                toast.success(data.message, { duration: 5000 });
            } else if (data.type === 'borrow_rejected') {
                toast.error(data.message, { duration: 5000 });
                if (window.location.pathname === '/my-borrowings') window.dispatchEvent(new CustomEvent('refresh-borrowings'));
            } else if (data.type === 'borrow_cancelled') {
                toast.error(data.message, { icon: '🚫', duration: 5000 });
                if (window.location.pathname === '/borrowings') window.dispatchEvent(new CustomEvent('refresh-borrowings'));
            } else if (data.type === 'return_approved') {
                toast.success(data.message, { duration: 5000 });
            } else if (data.type === 'borrow_request' || data.type === 'return_request') {
                toast(data.message, { icon: '🔔', duration: 5000 });
                if (window.location.pathname === '/borrowings') window.dispatchEvent(new CustomEvent('refresh-borrowings'));
            } else {
                toast(data.message, { duration: 4000 });
            }

            // Trigger a custom event for components to refresh data
            window.dispatchEvent(new CustomEvent('socket-notification', { detail: data }));
        });

        newSocket.on('user:updated', (data) => {
            console.log('User data updated from server:', data);
            if (user && data.id === user.id) {
                updateUser(data);
            }
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }, [user?.id]);

    return (
        <SocketContext.Provider value={socket}>
            {children}
        </SocketContext.Provider>
    );
};
