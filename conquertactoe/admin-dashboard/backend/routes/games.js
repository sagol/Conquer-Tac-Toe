const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// GET /admin/games - List active/recent games
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                g.id,
                g.creator_id,
                u1.username as creator_name,
                g.joiner_id,
                u2.username as joiner_name,
                g.status,
                g.variant_id,
                g.created_at,
                g.updated_at
            FROM "GameRequests" g
            LEFT JOIN "Users" u1 ON g.creator_id = u1.user_id
            LEFT JOIN "Users" u2 ON g.joiner_id = u2.user_id
            ORDER BY g.updated_at DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// DELETE /admin/games/:id - Cancel/Delete a game
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM "GameRequests" WHERE id = $1', [id]);
        res.json({ message: 'Game deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
