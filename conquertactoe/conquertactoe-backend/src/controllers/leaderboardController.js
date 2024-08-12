const Leaderboard = require('../models/Leaderboard');

exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await Leaderboard.getAll();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
