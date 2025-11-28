const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');
const gameRequestRoutes = require('./gameRequestRoutes');
const userRoutes = require('./userRoutes');
const statsRoutes = require('./statsRoutes');
const gameVariantRoutes = require('./gameVariantRoutes');
const configRoutes = require('./configRoutes');

// Use the routes
router.use(authRoutes);
router.use(leaderboardRoutes);
router.use(gameRequestRoutes);
router.use(userRoutes);
router.use(statsRoutes);
router.use(gameVariantRoutes);
router.use('/api/config', configRoutes);

module.exports = router;
