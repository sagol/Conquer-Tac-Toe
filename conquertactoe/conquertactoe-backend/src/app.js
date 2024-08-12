const express = require('express');
const http = require('http');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('./routes');
const socket = require('./socket');
require('dotenv').config();
require('./config/passport');

const app = express();
const server = http.createServer(app);
const io = socket.init(server); // Initialize Socket.io

const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set secure to true in production
}));
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  console.log('User:', req.user);
  next();
});

app.use(routes);

module.exports = { app, server };
