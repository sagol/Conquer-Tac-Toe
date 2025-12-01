const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { ClickHouse } = require('clickhouse');

// Load environment variables
dotenv.config();

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
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const clickhouse = new ClickHouse({
    url: `http://${process.env.CLICKHOUSE_HOST || 'conquertactoe_clickhouse'}`,
    port: 8123, // Use HTTP port
    debug: false,
    basicAuth: null,
    isUseGzip: false,
    format: "json",
    raw: false,
    config: {
        session_id: 'admin_dashboard',
        session_timeout: 60,
        output_format_json_quote_64bit_integers: 0,
        enable_http_compression: 0,
        database: 'default',
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

// ... (imports)

// Routes
app.use('/admin/auth', require('./routes/auth'));
app.use('/admin/users', require('./routes/users'));
app.use('/admin/games', require('./routes/games'));
app.use('/admin/analytics', require('./routes/analytics'));
app.use('/admin/system', require('./routes/system'));
app.use('/admin/settings', require('./routes/settings'));
app.use('/admin/docker', require('./routes/docker'));

// Error Handling
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    logger.info(`Admin Backend running on port ${PORT}`);
});

module.exports = { app, pool, clickhouse };
