const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { ClickHouse } = require('clickhouse');

// Load environment variables
dotenv.config();

// Fail closed: the admin JWT secret must be configured (never fall back to a public default).
if (!process.env.ADMIN_JWT_SECRET) {
    console.error('FATAL: ADMIN_JWT_SECRET is not set. Refusing to start.');
    process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ADMIN_ALLOWED_ORIGINS ? process.env.ADMIN_ALLOWED_ORIGINS.split(',') : 'http://localhost:3002',
    credentials: true
}));
app.use(express.json());

const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX_REQUESTS || 100
});
app.use(limiter);

// Session Management (required for OAuth)
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-admin-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport Initialization (for OAuth)
const passport = require('./config/passport-admin');
app.use(passport.initialize());
app.use(passport.session());

// Database Connections
const pool = require('./config/db');

const clickhouse = new ClickHouse({
    url: `http://${process.env.CLICKHOUSE_HOST}`,
    port: process.env.CLICKHOUSE_HTTP_PORT || 8123,
    debug: false,
    basicAuth: {
        username: process.env.CLICKHOUSE_USER || 'default',
        password: process.env.CLICKHOUSE_PASSWORD || '',
    },
    isUseGzip: false,
    format: "json",
    raw: false,
    config: {
        database: process.env.CLICKHOUSE_DB || 'default',
    },
});

// Health Check
app.get('/health', async (req, res) => {
    try {
        const dbRes = await pool.query('SELECT 1');
        const chRes = await clickhouse.query('SELECT 1').toPromise();
        res.json({
            status: 'ok',
            postgres: dbRes.rowCount === 1 ? 'connected' : 'error',
            clickhouse: chRes ? 'connected' : 'error'
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

const logger = require('./utils/logger');

// Require a valid admin JWT on every /admin route except /admin/auth.
function requireAdmin(req, res, next) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Routes
app.use('/admin/auth', require('./routes/auth'));
app.use('/admin', requireAdmin); // everything below requires authentication
app.use('/admin/users', require('./routes/users'));
app.use('/admin/games', require('./routes/games'));
app.use('/admin/analytics', require('./routes/analytics'));
app.use('/admin/system', require('./routes/system'));
app.use('/admin/settings', require('./routes/settings'));

// Error Handling
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    logger.info(`Admin Backend running on port ${PORT}`);
});

module.exports = { app, pool, clickhouse };
