const pool = require('../config/db');

class Stats {
    // Get global statistics for homepage
    static async getGlobalStats() {
        try {
            const query = `
        SELECT 
          COUNT(DISTINCT u.user_id) as total_users,
          COUNT(DISTINCT CASE WHEN gr.status IN ('won', 'draw', 'surrendered') THEN gr.id END) as total_games,
          COUNT(DISTINCT CASE WHEN gr.status = 'joined' THEN gr.id END) as active_games,
          COUNT(DISTINCT CASE WHEN gr.game_type = 'public' AND gr.status IN ('won', 'draw', 'surrendered') THEN gr.id END) as pvp_games,
          COUNT(DISTINCT CASE WHEN gr.game_type = 'bot' AND gr.status IN ('won', 'draw') THEN gr.id END) as bot_games,
          COUNT(DISTINCT CASE WHEN gr.game_type = 'bot' AND gr.status = 'won' AND gr.winner = 2 THEN gr.id END) as bot_wins,
          COUNT(DISTINCT CASE WHEN gr.game_type = 'bot' AND gr.status = 'won' AND gr.winner != 2 THEN gr.id END) as player_wins_vs_bot,
          COUNT(DISTINCT CASE WHEN gr.created_at::date = CURRENT_DATE THEN gr.id END) as games_today
        FROM Users u
        LEFT JOIN GameRequests gr ON (gr.creator_id = u.user_id OR gr.joiner_id = u.user_id)
      `;

            const result = await pool.query(query);
            const stats = result.rows[0];

            // Calculate win rates
            const totalBotGames = parseInt(stats.bot_games) || 0;
            const botWins = parseInt(stats.bot_wins) || 0;
            const playerWinsVsBot = parseInt(stats.player_wins_vs_bot) || 0;

            stats.bot_win_rate = totalBotGames > 0
                ? parseFloat((botWins / totalBotGames * 100).toFixed(1))
                : 0;

            stats.player_win_rate = totalBotGames > 0
                ? parseFloat((playerWinsVsBot / totalBotGames * 100).toFixed(1))
                : 0;

            return stats;
        } catch (err) {
            throw new Error('Error fetching global stats: ' + err.message);
        }
    }
}

module.exports = Stats;
