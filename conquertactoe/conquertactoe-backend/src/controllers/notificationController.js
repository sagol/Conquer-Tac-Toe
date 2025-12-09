const Notification = require('../models/Notification');
const socket = require('../socket');

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const notifications = await Notification.findByUser(userId);
        const unreadCount = await Notification.getUnreadCount(userId);
        res.json({ notifications, unreadCount });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

exports.markRead = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { id } = req.params;
        const notification = await Notification.markAsRead(id, userId);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json(notification);
    } catch (err) {
        console.error('Error marking notification as read:', err);
        res.status(500).json({ error: 'Failed to update notification' });
    }
};

exports.markAllRead = async (req, res) => {
    try {
        const userId = req.user.user_id;
        await Notification.markAllAsRead(userId);
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        console.error('Error marking all notifications as read:', err);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};

exports.createSystemNotification = async (req, res) => {
    try {
        // This endpoint is protected by ensureAdmin middleware (see notificationRoutes.js)

        const { userId, message, type = 'system' } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        const notification = await Notification.create(userId, type, message);

        // Emit real-time event
        const io = socket.getIo();
        io.to(`user_${userId}`).emit('notification', notification);

        res.json(notification);
    } catch (err) {
        console.error('Error creating system notification:', err);
        res.status(500).json({ error: 'Failed to create notification' });
    }
};
