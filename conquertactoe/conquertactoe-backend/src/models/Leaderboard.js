const pool = require('../config/db');

class Leaderboard {
  // Get PvP leaderboard (players vs players only)
  static async getPvPLeaderboard(limit = 100) {
    try {
      const query = `
        SELECT 
          u.user_id,
          u.username,
          COUNT(DISTINCT gr.id) as total_games,
          SUM(CASE WHEN gr.winner = u.user_id THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN gr.status = 'won' AND gr.winner != u.user_id THEN 1 ELSE 0 END) as losses,
          SUM(CASE WHEN gr.status = 'draw' THEN 1 ELSE 0 END) as draws,
          CASE 
            WHEN COUNT(DISTINCT gr.id) > 0 
            THEN ROUND(SUM(CASE WHEN gr.winner = u.user_id THEN 1 ELSE 0 END)::numeric / COUNT(DISTINCT gr.id)::numeric, 3)
            ELSE 0 
          END as win_rate
        FROM Users u
        LEFT JOIN GameRequests gr ON (gr.creator_id = u.user_id OR gr.joiner_id = u.user_id)
          AND gr.game_type = 'public'
          AND gr.status IN ('won', 'draw', 'surrendered')
        GROUP BY u.user_id
        HAVING COUNT(DISTINCT gr.id) > 0
        ORDER BY wins DESC, win_rate DESC
        LIMIT $1
      `;
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (err) {
      throw new Error('Error fetching PvP leaderboard: ' + err.message);
    }
  }

  // Get Bot leaderboard (players vs AI only)
  static async getBotLeaderboard(limit = 100) {
    try {
      const query = `
        SELECT 
          u.user_id,
          u.username,
          COUNT(DISTINCT gr.id) as total_games,
          SUM(CASE WHEN gr.winner = u.user_id THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN gr.winner = 2 THEN 1 ELSE 0 END) as losses,
          SUM(CASE WHEN gr.status = 'draw' THEN 1 ELSE 0 END) as draws,
          CASE 
            WHEN COUNT(DISTINCT gr.id) > 0 
            THEN ROUND(SUM(CASE WHEN gr.winner = u.user_id THEN 1 ELSE 0 END)::numeric / COUNT(DISTINCT gr.id)::numeric, 3)
            ELSE 0 
          END as win_rate
        FROM Users u
        LEFT JOIN GameRequests gr ON gr.creator_id = u.user_id
          AND gr.game_type = 'bot'
          AND gr.status IN ('won', 'draw')
        GROUP BY u.user_id
        HAVING COUNT(DISTINCT gr.id) > 0
        ORDER BY wins DESC, win_rate DESC
        LIMIT $1
      `;
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (err) {
      throw new Error('Error fetching Bot leaderboard: ' + err.message);
    }
  }

  // Get player stats (both PvP and Bot)
  static async getPlayerStats(userId) {
    try {
      const query = `
        SELECT 
          u.user_id,
          u.username,
          u.email,
          u.created_at,
          -- PvP Stats
          COUNT(DISTINCT CASE WHEN gr.game_type = 'public' AND gr.status IN ('won', 'draw', 'surrendered') THEN gr.id END) as pvp_total_games,
          SUM(CASE WHEN gr.game_type = 'public' AND gr.winner = u.user_id THEN 1 ELSE 0 END) as pvp_wins,
          SUM(CASE WHEN gr.game_type = 'public' AND gr.status = 'won' AND gr.winner != u.user_id THEN 1 ELSE 0 END) as pvp_losses,
          SUM(CASE WHEN gr.game_type = 'public' AND gr.status = 'draw' THEN 1 ELSE 0 END) as pvp_draws,
          -- Bot Stats
          COUNT(DISTINCT CASE WHEN gr.game_type = 'bot' AND gr.status IN ('won', 'draw') THEN gr.id END) as bot_total_games,
          SUM(CASE WHEN gr.game_type = 'bot' AND gr.winner = u.user_id THEN 1 ELSE 0 END) as bot_wins,
          SUM(CASE WHEN gr.game_type = 'bot' AND gr.winner = 2 THEN 1 ELSE 0 END) as bot_losses,
          SUM(CASE WHEN gr.game_type = 'bot' AND gr.status = 'draw' THEN 1 ELSE 0 END) as bot_draws
        FROM Users u
        LEFT JOIN GameRequests gr ON (gr.creator_id = u.user_id OR gr.joiner_id = u.user_id)
        WHERE u.user_id = $1
        GROUP BY u.user_id
      `;
      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const stats = result.rows[0];

      // Calculate win rates
      stats.pvp_win_rate = stats.pvp_total_games > 0
        ? parseFloat((stats.pvp_wins / stats.pvp_total_games).toFixed(3))
        : 0;

      stats.bot_win_rate = stats.bot_total_games > 0
        ? parseFloat((stats.bot_wins / stats.bot_total_games).toFixed(3))
        : 0;

      return stats;
    } catch (err) {
      throw new Error('Error fetching player stats: ' + err.message);
    }
  }

  // Search for a player by username
  static async searchPlayer(username) {
    try {
      const query = `
        SELECT user_id, username
        FROM Users
        WHERE LOWER(username) LIKE LOWER($1)
        LIMIT 10
      `;
      const result = await pool.query(query, [`%${username}%`]);
      return result.rows;
    } catch (err) {
      throw new Error('Error searching for player: ' + err.message);
    }
  }
}

module.exports = Leaderboard;
