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
    }, [user]);

    const markAsRead = async (id) => {
        // Handle synthetic notifications (IDs like "rematch_48_1234567890")
        // These don't exist in the database, just remove them from local state
        if (typeof id === 'string' && id.startsWith('rematch_')) {
            setNotifications(prev => prev.filter(n => n.id !== id));
            setUnreadCount(prev => Math.max(0, prev - 1));
            return;
        }

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
                // Mark as read in backend asynchronously
                axios.put(`${backendUrl}/notifications/${notification.id}/read`, {}, { withCredentials: true })
                    .catch(err => {
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

        // Listen for rematchRequested events globally
        // This shows a toast when user receives a rematch request while NOT viewing the game board
        const handleRematchRequested = ({ gameId, requesterId, requesterName, timeoutMs }) => {
            console.log('[NotificationContext] Received rematchRequested:', { gameId, requesterName });

            // If user is currently viewing this game, GameBoard will handle it
            if (String(gameId) === String(currentGameIdRef.current)) {
                console.log('[NotificationContext] User is viewing this game, GameBoard will handle it');
                return;
            }

            // Create a synthetic notification to show as toast
            const syntheticNotification = {
                id: `rematch_${gameId}_${Date.now()}`, // Temporary ID
                type: 'rematch_request',
                message: `${requesterName || 'A player'} wants a rematch!|game_id:${gameId}|rematch:true`,
                is_read: false,
                created_at: new Date().toISOString()
            };

            // Add to notifications list and show toast
            setNotifications(prev => [syntheticNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            setToast(syntheticNotification);
        };

        socket.on('rematchRequested', handleRematchRequested);

        // Clean up synthetic rematch notifications when rematch is resolved
        const handleRematchResolved = ({ gameId, originalGameId }) => {
            const targetGameId = originalGameId || gameId;
            console.log('[NotificationContext] Rematch resolved for game:', targetGameId);
            // Remove synthetic notifications for this game
            setNotifications(prev => prev.filter(n => {
                if (typeof n.id === 'string' && n.id.startsWith('rematch_')) {
                    // Check if this notification is for the resolved game
                    const notifGameId = n.id.split('_')[1];
                    return notifGameId !== String(targetGameId);
                }
                return true;
            }));
        };

        socket.on('rematchAccepted', handleRematchResolved);
        socket.on('rematchDeclined', handleRematchResolved);
        socket.on('rematchTimeout', handleRematchResolved);
        socket.on('rematchCancelled', handleRematchResolved);

        return () => {
            socket.off('connect', joinUserRoom);
            socket.off('notification', handleNotification);
            socket.off('rematchRequested', handleRematchRequested);
            socket.off('rematchAccepted', handleRematchResolved);
            socket.off('rematchDeclined', handleRematchResolved);
            socket.off('rematchTimeout', handleRematchResolved);
            socket.off('rematchCancelled', handleRematchResolved);
        };
    }, [user, backendUrl]);

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
