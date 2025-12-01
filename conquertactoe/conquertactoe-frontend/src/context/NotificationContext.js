import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import socket from '../utils/socket'; // socket.js is in src/utils/

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [toast, setToast] = useState(null);

    // Use Redux selector to get user
    const user = useSelector(state => state.auth.user);

    const fetchNotifications = async () => {
        if (!user) return;
        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
            const res = await axios.get(`${backendUrl}/notifications`, { withCredentials: true });
            setNotifications(res.data.notifications);
            setUnreadCount(res.data.unreadCount);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    const markAsRead = async (id) => {
        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
            await axios.put(`${backendUrl}/notifications/${id}/read`, {}, { withCredentials: true });

            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, is_read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
            await axios.put(`${backendUrl}/notifications/read-all`, {}, { withCredentials: true });

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    // Initial fetch
    useEffect(() => {
        if (user) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [user]);

    // Socket listener
    useEffect(() => {
        if (!socket || !user) return;

        // Join user room
        socket.emit('joinUserRoom', user.user_id);

        const handleNotification = (notification) => {
            console.log('Received notification:', notification);
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            setToast(notification);

            // Auto-hide toast after 5 seconds
            setTimeout(() => setToast(null), 5000);
        };

        socket.on('notification', handleNotification);

        return () => {
            socket.off('notification', handleNotification);
        };
    }, [user]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            fetchNotifications,
            markAsRead,
            markAllAsRead,
            toast,
            setToast
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
