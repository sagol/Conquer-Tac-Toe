const express = require('express');
const router = express.Router();
const leaderboardController = require('../controllers/leaderboardController');

// New enhanced endpoints
router.get('/leaderboard/pvp', leaderboardController.getPvPLeaderboard);
router.get('/leaderboard/bot', leaderboardController.getBotLeaderboard);
router.get('/leaderboard/player/:userId', leaderboardController.getPlayerStats);
router.get('/leaderboard/search', leaderboardController.searchPlayers);

// Legacy endpoint (for backward compatibility)
router.get('/leaderboard', leaderboardController.getLeaderboard);

module.exports = router;
