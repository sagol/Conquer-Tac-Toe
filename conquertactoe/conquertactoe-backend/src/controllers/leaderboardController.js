const Leaderboard = require('../models/Leaderboard');

// Get PvP leaderboard
exports.getPvPLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const leaderboard = await Leaderboard.getPvPLeaderboard(limit);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Bot leaderboard
exports.getBotLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const leaderboard = await Leaderboard.getBotLeaderboard(limit);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get player stats
exports.getPlayerStats = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const stats = await Leaderboard.getPlayerStats(userId);

    if (!stats) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search for players
exports.searchPlayers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const players = await Leaderboard.searchPlayer(query);
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Legacy endpoint (keep for backward compatibility)
exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await Leaderboard.getPvPLeaderboard(100);
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
