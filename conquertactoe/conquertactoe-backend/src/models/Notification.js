const pool = require('../config/db');

const Notification = {
    create: async (userId, type, message) => {
        // Input validation
        // Input validation
        const userIdNum = Number(userId);
        if (!userId || !Number.isInteger(userIdNum) || userIdNum <= 0) {
            throw new Error('Valid userId is required');
        }
        if (!type || typeof type !== 'string' || type.trim() === '') {
            throw new Error('Valid type is required');
        }
        if (!message || typeof message !== 'string' || message.trim() === '') {
            throw new Error('Valid message is required');
        }

        const result = await pool.query(
            'INSERT INTO Notifications (user_id, type, message) VALUES ($1, $2, $3) RETURNING *',
            [userId, type, message]
        );
        return result.rows[0];
    },

    findByUser: async (userId, limit = 50) => {
        const result = await pool.query(
            'SELECT * FROM Notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
            [userId, limit]
        );
        return result.rows;
    },

    markAsRead: async (notificationId, userId) => {
        const result = await pool.query(
            'UPDATE Notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
            [notificationId, userId]
        );
        return result.rows[0];
    },

    markAllAsRead: async (userId) => {
        await pool.query(
            'UPDATE Notifications SET is_read = TRUE WHERE user_id = $1',
            [userId]
        );
    },

    getUnreadCount: async (userId) => {
        const result = await pool.query(
            'SELECT COUNT(*) FROM Notifications WHERE user_id = $1 AND is_read = FALSE',
            [userId]
        );
        return parseInt(result.rows[0].count);
    }
};

module.exports = Notification;
