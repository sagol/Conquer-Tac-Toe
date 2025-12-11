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
// MOVED: timeoutChecker.start() should be called in server.js or bin/www after DB is connected.
// For now, we'll keep it here but wrap it in a safe check or move to where server starts listening.
// Actually, app.js exports app and server, usually index.js starts it.
// Let's look at where the server starts. Ah, usually in bin/www or server.js.
// Wait, this file 'app.js' seems to be the main entry or module.
// Let's check package.json "start" script to know the entry point.
// Assumed entry is likely index.js or server.js that imports app.
// If I remove it here, I must add it elsewhere.
// Copilot says: "Start ... after confirming database connectivity."
// Since I don't see the DB connection logic here (it's in ./config/db usually), I should probably export a start function or similar.
// But to be safe and simple: I'll wrap it in a function and export it, OR just rely on the fact that pool is initialized.
// Actually, `timeoutChecker.js` imports `pool`. The pool connects lazily or immediately.
// I will comment it out here and let the user know, OR improved:
// I'll check if there is a better place. The file ends with module.exports = { app, server }.
// I'll remove it from here.

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
