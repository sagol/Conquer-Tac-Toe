const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Use the pool from server.js (or create a new one if needed, but better to export/import)
// For simplicity in this structure, I'll assume we can access the db via a shared module or just recreate the pool config
// Ideally, we should have a db.js module. Let's create a quick db instance here for now to keep it self-contained or refactor server.js later.
// Actually, let's just use the env var.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// GET /admin/users - List all users with stats
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.user_id, 
                u.username, 
                u.email, 
                u.created_at,
                u.is_banned,
                u.ban_expires_at,
                u.ban_reason,
                COALESCE(s.wins, 0) as wins,
                COALESCE(s.losses, 0) as losses,
                COALESCE(s.draws, 0) as draws
            FROM users u
            LEFT JOIN leaderboards s ON u.user_id = s.user_id
            ORDER BY u.created_at DESC
            LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /admin/users/:id - Get specific user details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const statsRes = await pool.query('SELECT * FROM leaderboards WHERE user_id = $1', [id]);

        res.json({
            user: userRes.rows[0],
            stats: statsRes.rows[0] || {}
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// PUT /admin/users/:id - Update user details
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email } = req.body;

        // Basic validation
        if (!username || !email) {
            return res.status(400).json({ error: 'Username and email are required' });
        }

        const result = await pool.query(
            'UPDATE users SET username = $1, email = $2 WHERE user_id = $3 RETURNING *',
            [username, email, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Username or email already exists' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /admin/users/:id/ban - Ban user
router.post('/:id/ban', async (req, res) => {
    try {
        const { id } = req.params;
        const { duration, reason, permanent } = req.body; // duration in hours

        let expiresAt = null;
        if (!permanent && duration) {
            expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);
        }

        await pool.query(
            'UPDATE users SET is_banned = TRUE, ban_expires_at = $1, ban_reason = $2 WHERE user_id = $3',
            [expiresAt, reason, id]
        );

        res.json({ message: 'User banned successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /admin/users/:id/unban - Unban user
router.post('/:id/unban', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            'UPDATE users SET is_banned = FALSE, ban_expires_at = NULL, ban_reason = NULL WHERE user_id = $1',
            [id]
        );
        res.json({ message: 'User unbanned successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE /admin/users/:id - Delete user (Hard delete)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
