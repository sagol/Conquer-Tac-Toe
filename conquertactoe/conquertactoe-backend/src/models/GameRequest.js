const pool = require('../config/db');

class GameRequest {
  static async create(creatorId, gameType) {
    const initialBoard = Array(3).fill().map(() => Array(3).fill(null));
    const player1Cones = [3, 3, 3];
    const player2Cones = [3, 3, 3];
    const result = await pool.query(
      'INSERT INTO GameRequests (creator_id, game_type, status, board, active_player, player1_cones, player2_cones, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *',
      [creatorId, gameType, 'pending', JSON.stringify(initialBoard), 1, JSON.stringify(player1Cones), JSON.stringify(player2Cones)]
    );
    return result.rows[0];
  }

  static async getAllActive() {
    const result = await pool.query(
      'SELECT * FROM GameRequests WHERE status = $1 ORDER BY created_at DESC',
      ['pending']
    );
    return result.rows;
  }

  static async getPendingByUser(userId) {
    const result = await pool.query(
      'SELECT * FROM GameRequests WHERE creator_id = $1 AND status = $2',
      [userId, 'pending']
    );
    return result.rows;
  }

  static async getJoinedByUser(userId) {
    const result = await pool.query(
      'SELECT * FROM GameRequests WHERE joiner_id = $1 AND status = $2',
      [userId, 'joined']
    );
    return result.rows;
  }

  static async getGamesUserHasCreatedOrJoined(userId) {
    const result = await pool.query(
      `SELECT * FROM GameRequests WHERE (creator_id = $1 OR joiner_id = $1) ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  static async join(requestId, joinerId) {
    const result = await pool.query(
      'UPDATE GameRequests SET joiner_id = $1, status = $2 WHERE id = $3 RETURNING *',
      [joinerId, 'joined', requestId]
    );
    return result.rows[0];
  }

  static async cancel(requestId) {
    const result = await pool.query(
      'UPDATE GameRequests SET status = $1 WHERE id = $2 RETURNING *',
      ['cancelled', requestId]
    );
    return result.rows[0];
  }

  static async getById(requestId) {
    const result = await pool.query(
      'SELECT * FROM GameRequests WHERE id = $1',
      [requestId]
    );
    return result.rows[0];
  }

  static async updateBoard(gameId, board, activePlayer, player1Cones, player2Cones) {
    const result = await pool.query(
      'UPDATE GameRequests SET board = $1, active_player = $2, player1_cones = $3, player2_cones = $4 WHERE id = $5 RETURNING *',
      [JSON.stringify(board), activePlayer, JSON.stringify(player1Cones), JSON.stringify(player2Cones), gameId]
    );
    return result.rows[0];
  }

  static async markGameWon(gameId, winnerId) {
    const result = await pool.query(
      'UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3 RETURNING *',
      ['won', winnerId, gameId]
    );
    return result.rows[0];
  }
}

module.exports = GameRequest;
