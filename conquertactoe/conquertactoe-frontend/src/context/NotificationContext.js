import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import socket from '../utils/socket';
import { NOTIFICATION_GAME_ID_REGEX } from '../utils/constants';

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [toast, setToast] = useState(null);

    // Use Redux selector to get user
    const user = useSelector(state => state.auth.user);

    // Track current game being viewed to suppress notifications for it
    const location = useLocation();
    const currentGameId = location.pathname.match(/^\/game\/(\d+)/)?.[1] || null;

    // Use Ref to track current game ID to avoid socket listener churn
    const currentGameIdRef = React.useRef(currentGameId);
    useEffect(() => {
        currentGameIdRef.current = currentGameId;
    }, [currentGameId]);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const res = await axios.get(`${backendUrl}/notifications`, { withCredentials: true });
            setNotifications(res.data.notifications);
            setUnreadCount(res.data.unreadCount);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }, [user?.user_id]);

    const markAsRead = async (id) => {
        try {
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
    }, [user, fetchNotifications]);

    // Socket listener with reconnection handling
    useEffect(() => {
        if (!socket || !user) return;

        const joinUserRoom = () => {
            console.log('Joining user notification room:', user.user_id);
            socket.emit('joinUserRoom', user.user_id);
        };

        // Join room immediately if already connected
        if (socket.connected) {
            joinUserRoom();
        }

        // Re-join room on reconnect (critical fix for refresh issue)
        socket.on('connect', joinUserRoom);

        const handleNotification = (notification) => {
            console.log('Received notification:', notification);

            // Extract game_id from notification message using shared regex
            const gameIdMatch = notification.message?.match(NOTIFICATION_GAME_ID_REGEX);
            const notificationGameId = gameIdMatch ? gameIdMatch[1] : null;

            // Suppress toast and count for notifications about the currently viewed game
            // Use String comparison to be safe
            if (notificationGameId && String(notificationGameId) === String(currentGameIdRef.current)) {
                console.log(`Suppressing notification for current game ${currentGameIdRef.current}`);
                // Still add to list but mark as read immediately
                setNotifications(prev => [{ ...notification, is_read: true }, ...prev]);

                // Mark as read in backend so it doesn't show up as unread on refresh
                // Wrap in try-catch logic (simplified as promise catch here)
                axios.put(`${backendUrl}/notifications/${notification.id}/read`, {}, { withCredentials: true })
                    .catch(async err => {
                        console.error('Error auto-marking notification as read:', err);
                        // Revert local state if backend fails? 
                        // It's complex to revert specific item in list without full refetch or reducer.
                        // For now, we log error. A full revert might jank the UI.
                        // Ideally we'd optimize the optimistic update.
                    });

                return;
            }

            // Normal notification handling for other games
            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
            setToast(notification);
        };

        socket.on('notification', handleNotification);

        return () => {
            socket.off('connect', joinUserRoom);
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
            // currentGameId removed as it's internal
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
