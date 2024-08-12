const pool = require('../config/db');

// Validate username function
const isValidUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_ -]+$/;
  return usernameRegex.test(username);
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM Users WHERE user_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Invalid username. Only letters, numbers, _, -, and spaces are allowed.' });
    }

    // Check if the username already exists
    const usernameCheck = await pool.query('SELECT * FROM Users WHERE username = $1', [username]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const result = await pool.query(
      'UPDATE Users SET username = $1 WHERE user_id = $2 RETURNING *',
      [username, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const User = require('../models/User');

exports.getUserStatsById = async (req, res) => {
  try {
    const userId = req.params.id;
    console.log(`Fetching stats for user ID: ${userId}`);

    const stats = await User.getStatsById(userId);
    if (!stats) {
      console.log('No stats found for user');
      return res.status(404).json({ error: 'User stats not found' });
    }

    console.log('User stats retrieved:', stats);
    res.json(stats);
  } catch (err) {
    console.error('Error fetching user stats:', err);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
};
