const Notification = require('../models/Notification');
const User = require('../models/User');
const socket = require('../socket');

// ... (existing exports)

exports.createSystemNotification = async (req, res) => {
    try {
        // This endpoint is protected by ensureAdmin middleware (see notificationRoutes.js)

        const { userId, message, type = 'system' } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        // Validate that userId is a valid integer
        if (!Number.isInteger(Number(userId))) {
            return res.status(400).json({ error: 'userId must be a valid integer' });
        }

        // Validate that user exists
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
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
