const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const userController = require('../controllers/userController');
const router = express.Router();

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(403).json({ error: 'Authorization header is missing' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  });
};

// Profile route (used for testing token-based authentication)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Profile route - User:', user);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Define the route to get user information by ID
router.get('/users/:id', userController.getUserById);

// Define the route to update user information by ID
router.put('/users/:id', userController.updateUserById);

// Add this route to handle user stats
router.get('/users/:id/stats', userController.getUserStatsById);

module.exports = router;