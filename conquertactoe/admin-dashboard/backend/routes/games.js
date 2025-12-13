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
                g.created_at
            FROM gamerequests g
            LEFT JOIN users u1 ON g.creator_id = u1.user_id
            LEFT JOIN users u2 ON g.joiner_id = u2.user_id
            ORDER BY g.created_at DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /admin/games/:id/reset - Reset a game
// POST /admin/games/:id/reset - Reset a game
router.post('/:id/reset', async (req, res) => {
    try {
        const { id } = req.params;
        const axios = require('axios');

        // Call Main Backend internal API
        // Assuming main backend is at http://conquertactoe_backend:3000 (docker service name)
        // Or use process.env.BACKEND_INTERNAL_URL if defined
        const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://conquertactoe_backend:3000';

        console.log(`Calling reset on main backend: ${backendUrl}/internal/games/${id}/reset`);

        await axios.post(`${backendUrl}/internal/games/${id}/reset`);

        res.json({ message: 'Game reset successfully' });
    } catch (err) {
        console.error('Error resetting game via main backend:', err.message);
        if (err.response) {
            console.error('Backend response:', err.response.data);
            return res.status(err.response.status).json(err.response.data);
        }
        res.status(500).json({ error: 'Failed to reset game' });
    }
});

// DELETE /admin/games/:id - Cancel/Delete a game
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM gamerequests WHERE id = $1', [id]);
        res.json({ message: 'Game deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
