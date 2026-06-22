const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const pool = require('../config/db');

// Public config endpoint to check if dev login is enabled
router.get('/config', async (req, res) => {
    try {
        const result = await pool.query("SELECT config_value FROM appconfig WHERE config_key = 'ENABLE_DEV_LOGIN'");
        const isDevLoginEnabled = result.rows.length > 0 && result.rows[0].config_value === 'true';
        res.json({ enableDevLogin: isDevLoginEnabled });
    } catch (err) {
        logger.error('Error fetching auth config:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin Login (Password)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if Dev Login is enabled
        const configResult = await pool.query("SELECT config_value FROM appconfig WHERE config_key = 'ENABLE_DEV_LOGIN'");
        const isDevLoginEnabled = configResult.rows.length > 0 && configResult.rows[0].config_value === 'true';

        if (!isDevLoginEnabled) {
            return res.status(403).json({ error: 'Password login is currently disabled.' });
        }

        // Find user
        const result = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);

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

// OAuth Routes
const passport = require('../config/passport-admin');

// Initiate Google OAuth
router.get('/google', passport.authenticate('google-admin', {
    scope: ['profile', 'email']
}));

// Google OAuth callback
router.get('/google/callback', (req, res, next) => {
    const frontendUrl = process.env.ADMIN_FRONTEND_URL || 'http://localhost:3002';

    passport.authenticate('google-admin', (err, user, info) => {
        if (err) {
            logger.error('OAuth error:', err);
            return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
        }

        if (!user) {
            logger.warn('OAuth authentication failed:', info?.message || 'Unknown reason');
            return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
        }

        // Log the user in
        req.logIn(user, async (loginErr) => {
            if (loginErr) {
                logger.error('Login error after OAuth:', loginErr);
                return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
            }

            // Successful authentication
            logger.info(`Admin logged in via OAuth: ${user.username}`);

            try {
                // Update last login
                await pool.query('UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE user_id = $1', [user.user_id]);

                // Generate JWT Token
                const token = jwt.sign(
                    { id: user.user_id, role: user.role, email: user.email },
                    process.env.ADMIN_JWT_SECRET || 'secret',
                    { expiresIn: '1h' }
                );

                // Redirect to admin frontend login page with token
                // We redirect to /login so the Login component can extract the token
                // before PrivateRoute checks for it on the root path
                res.redirect(`${frontendUrl}/login?auth=success&token=${token}`);
            } catch (err) {
                logger.error('Error generating token or updating user:', err);
                res.redirect(`${frontendUrl}/login?error=server_error`);
            }
        });
    })(req, res, next);
});

// Logout route
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            logger.error('Logout error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

// Get current user (for session-based auth)
router.get('/me', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({
        admin: {
            id: req.user.user_id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        }
    });
});

module.exports = router;
