const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            logger.warn(`Failed login attempt for email: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Check if user has admin role
        if (user.role !== 'admin' && user.role !== 'super_admin') {
            logger.warn(`Unauthorized login attempt for email: ${email} (role: ${user.role})`);
            return res.status(403).json({ error: 'Access denied' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            logger.warn(`Failed login attempt for email: ${email} (invalid password)`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query('UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE user_id = $1', [user.user_id]);

        const token = jwt.sign(
            { id: user.user_id, role: user.role, email: user.email },
            process.env.ADMIN_JWT_SECRET || 'secret',
            { expiresIn: '1h' }
        );

        logger.info(`Admin logged in: ${user.username}`);

        res.json({
            token,
            admin: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (err) {
        logger.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
