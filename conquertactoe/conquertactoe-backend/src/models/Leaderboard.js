const pool = require('../config/db');

class Leaderboard {
  static async getAll() {
    try {
      const result = await pool.query('SELECT user_id, username, wins FROM Users ORDER BY wins DESC LIMIT 100');
      return result.rows;
    } catch (err) {
      throw new Error('Error fetching leaderboard: ' + err.message);
    }
  }
}

module.exports = Leaderboard;
