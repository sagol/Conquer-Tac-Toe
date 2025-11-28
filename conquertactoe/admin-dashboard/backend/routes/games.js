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
router.post('/:id/reset', async (req, res) => {
    try {
        const { id } = req.params;

        // Get current game state to check joiner
        const gameRes = await pool.query('SELECT joiner_id, creator_id FROM gamerequests WHERE id = $1', [id]);
        if (gameRes.rows.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const game = gameRes.rows[0];
        const newStatus = game.joiner_id ? 'joined' : 'pending';

        await pool.query(`
            UPDATE gamerequests 
            SET 
                board = NULL, 
                status = $1, 
                active_player = $2, 
                winner = NULL, 
                player1_cones = NULL, 
                player2_cones = NULL,
                created_at = NOW() -- Optional: update timestamp to show it's fresh
            WHERE id = $3
        `, [newStatus, game.creator_id, id]);

        res.json({ message: 'Game reset successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
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
