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
                u.last_login,
                COALESCE(s.wins, 0) as wins,
                COALESCE(s.losses, 0) as losses,
                COALESCE(s.draws, 0) as draws
            FROM "Users" u
            LEFT JOIN "Leaderboards" s ON u.user_id = s.user_id
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
        const userRes = await pool.query('SELECT * FROM "Users" WHERE user_id = $1', [id]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const statsRes = await pool.query('SELECT * FROM "Leaderboards" WHERE user_id = $1', [id]);

        res.json({
            user: userRes.rows[0],
            stats: statsRes.rows[0] || {}
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE /admin/users/:id - Delete/Ban user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // In a real app, we might just soft delete or set a 'banned' flag.
        // For now, let's assume hard delete for simplicity, or we can add a banned column if it exists.
        // Checking schema... assuming standard delete for now.
        await pool.query('DELETE FROM "Users" WHERE user_id = $1', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
