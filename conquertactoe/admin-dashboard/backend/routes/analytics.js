const express = require('express');
const router = express.Router();
const { ClickHouse } = require('clickhouse');

const clickhouse = new ClickHouse({
    url: `http://${process.env.CLICKHOUSE_HOST}`,
    port: 8123, // Use HTTP port, not native protocol port
    debug: false,
    basicAuth: null,
    isUseGzip: false,
    format: "json",
    raw: false,
    config: {
        database: 'default',
    },
});

// GET /admin/analytics/moves - Get recent moves
router.get('/moves', async (req, res) => {
    try {
        const query = `
            SELECT *
            FROM game_moves
            ORDER BY timestamp DESC
            LIMIT 100
        `;
        const rows = await clickhouse.query(query).toPromise();
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'ClickHouse error' });
    }
});

// GET /admin/analytics/stats - Aggregated stats
router.get('/stats', async (req, res) => {
    try {
        const query = `
            SELECT 
                count() as total_moves,
                uniq(game_id) as total_games_analyzed,
                max(timestamp) as last_move_time
            FROM game_moves
        `;
        const rows = await clickhouse.query(query).toPromise();
        res.json(rows[0] || { total_moves: 0, total_games_analyzed: 0, last_move_time: null });
    } catch (err) {
        console.error('ClickHouse error:', err);
        // Return default values if ClickHouse is unavailable
        res.json({
            total_moves: 0,
            total_games_analyzed: 0,
            last_move_time: null,
            error: 'Analytics data unavailable'
        });
    }
});

module.exports = router;
