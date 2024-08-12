const pool = require('../config/db');

const GameMove = {
  create: async (gameId, playerId, moveNumber, cellPosition, coneSize) => {
    const result = await pool.query('INSERT INTO GameMoves (game_id, player_id, move_number, cell_position, cone_size) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
                                    [gameId, playerId, moveNumber, cellPosition, coneSize]);
    return result.rows[0];
  },

  findByGameId: async (gameId) => {
    const result = await pool.query('SELECT * FROM GameMoves WHERE game_id = $1 ORDER BY move_number ASC', [gameId]);
    return result.rows;
  }
};

module.exports = GameMove;
