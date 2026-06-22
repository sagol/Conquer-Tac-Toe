const express = require('express');
const router = express.Router();

const pool = require('../config/db');

// GET /admin/settings - Fetch all settings
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT config_key, config_value, description 
            FROM appconfig 
            ORDER BY config_key
        `);

        // Convert to object format for easier frontend handling
        const settings = {};
        result.rows.forEach(row => {
            settings[row.config_key] = {
                value: row.config_value,
                description: row.description
            };
        });

        res.json(settings);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// PUT /admin/settings/:key - Update a specific setting
router.put('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;

        if (value === undefined) {
            return res.status(400).json({ error: 'Value is required' });
        }

        const result = await pool.query(`
            UPDATE appconfig 
            SET config_value = $1, updated_at = NOW() 
            WHERE config_key = $2
            RETURNING *
        `, [value, key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({
            key: result.rows[0].config_key,
            value: result.rows[0].config_value,
            description: result.rows[0].description
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
