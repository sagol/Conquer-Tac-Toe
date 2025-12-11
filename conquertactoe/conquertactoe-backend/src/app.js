const express = require('express');
const http = require('http');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('./routes');
const socket = require('./socket');
const maintenanceMode = require('./middleware/maintenanceMode');
const timeoutChecker = require('./services/timeoutChecker');
require('dotenv').config();
require('./config/passport');
require('./services/clickhouseService');

// SESSION_SECRET validation
// Production: SESSION_SECRET is REQUIRED - fail hard if missing to prevent insecure deployment
// Development: Falls back to hardcoded value for local dev convenience
// This pattern prioritizes:
// 1. Security: Production fails immediately if SESSION_SECRET is missing (line 18)
// 2. Developer experience: Local development "just works" without manual env setup
// 3. Visibility: Warning ensures developers know they should set a real secret
// The development fallback is INTENTIONALLY insecure - it's never used in production.
if (!process.env.SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: SESSION_SECRET environment variable is not set.');
    process.exit(1);
  } else {
    console.warn('WARNING: SESSION_SECRET is not set. Using default insecure session secret for development only.');
    process.env.SESSION_SECRET = 'insecure-development-secret';
  }
}

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
// Initialize Socket.io after session middleware to enable shared authentication



const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Check maintenance mode before processing requests
app.use(maintenanceMode);

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Should be true for HTTPS
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // or 'lax'
    httpOnly: true,
  },
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

const dynamicRateLimiter = require('./middleware/rateLimiter');
const { getBooleanSetting } = require('./utils/settings');

// Initialize Socket.io after session middleware to enable shared authentication
socket.init(server, sessionMiddleware);

// Start the move timeout checker after socket is ready
timeoutChecker.start();

// Apply dynamic rate limiter
app.use(dynamicRateLimiter);

app.use(async (req, res, next) => {
  const devLogging = await getBooleanSetting('dev_logging', false);
  if (devLogging) {
    console.log(`${req.method} ${req.url}`);
    console.log('User:', req.user ? req.user.username : 'Guest');
  }
  next();
});

// Debug mode middleware to attach to response for error handling
app.use(async (req, res, next) => {
  req.debugMode = await getBooleanSetting('debug_mode', false);
  next();
});

const internalRoutes = require('./routes/internalRoutes');

app.use('/internal', internalRoutes);
app.use(routes);

module.exports = { app, server };
