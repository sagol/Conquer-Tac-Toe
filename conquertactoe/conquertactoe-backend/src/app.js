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

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);
// Socket.io initialization moved to after session middleware definition

// Start the move timeout checker after socket is ready
timeoutChecker.start();

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
  secure: process.env.NODE_ENV === 'production', // Should be true for HTTPS
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // or 'lax'
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

const dynamicRateLimiter = require('./middleware/rateLimiter');
const { getBooleanSetting } = require('./utils/settings');

// Initialize Socket.io with session middleware for shared auth
const io = socket.init(server, sessionMiddleware);
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
