const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');
const gameRequestRoutes = require('./gameRequestRoutes');
const userRoutes = require('./userRoutes');
const statsRoutes = require('./statsRoutes');

// Use the routes
router.use(authRoutes);
router.use(leaderboardRoutes);
router.use(gameRequestRoutes);
router.use(userRoutes);
router.use(statsRoutes);

module.exports = router;
