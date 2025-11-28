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
        const result = await pool.query('SELECT * FROM "AdminUsers" WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            logger.warn(`Failed login attempt for email: ${email}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = result.rows[0];
        const validPassword = await bcrypt.compare(password, admin.password_hash);

        if (!validPassword) {
            logger.warn(`Failed login attempt for email: ${email} (invalid password)`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.query('UPDATE "AdminUsers" SET last_login = NOW() WHERE id = $1', [admin.id]);

        const token = jwt.sign(
            { id: admin.id, role: admin.role, email: admin.email },
            process.env.ADMIN_JWT_SECRET || 'secret',
            { expiresIn: '1h' }
        );

        logger.info(`Admin logged in: ${admin.username}`);

        res.json({
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (err) {
        logger.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
