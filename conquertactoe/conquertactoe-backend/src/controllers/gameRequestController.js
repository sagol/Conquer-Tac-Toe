const GameRequest = require('../models/GameRequest');
const socket = require('../socket');
const pool = require('../config/db');

// Helper function to check for win conditions or draw
const checkGameOverCondition = (board, player1Cones, player2Cones) => {
  const checkRowsAndColumns = () => {
    for (let i = 0; i < 3; i++) {
      // Check rows
      if (
        board[i][0] && board[i][1] && board[i][2] && // Ensure all cells in the row are occupied
        board[i][0].player === board[i][1].player &&
        board[i][1].player === board[i][2].player // All cells in the row belong to the same player
      ) {
        return board[i][0].player;
      }
      // Check columns
      if (
        board[0][i] && board[1][i] && board[2][i] && // Ensure all cells in the column are occupied
        board[0][i].player === board[1][i].player &&
        board[1][i].player === board[2][i].player // All cells in the column belong to the same player
      ) {
        return board[0][i].player;
      }
    }
    return null;
  };

  const checkDiagonals = () => {
    if (
      board[0][0] && board[1][1] && board[2][2] && // Ensure all cells in the diagonal are occupied
      board[0][0].player === board[1][1].player &&
      board[1][1].player === board[2][2].player // All cells in the diagonal belong to the same player
    ) {
      return board[0][0].player;
    }
    if (
      board[0][2] && board[1][1] && board[2][0] && // Ensure all cells in the diagonal are occupied
      board[0][2].player === board[1][1].player &&
      board[1][1].player === board[2][0].player // All cells in the diagonal belong to the same player
    ) {
      return board[0][2].player;
    }
    return null;
  };

  const winner = checkRowsAndColumns() || checkDiagonals();
  if (winner) {
    return { winner };
  }

  // Check if any player can still make a move
  const hasValidMoves = (cones, board) => {
    for (let coneSize = 0; coneSize < 3; coneSize++) {
      if (cones[coneSize] > 0) { // Check if the player has cones of this size
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            const cell = board[row][col];
            if (!cell || coneSize >= cell.size) {
              // If there's an empty space or the player can place a cone over a smaller one
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  const player1CanMove = hasValidMoves(player1Cones, board);
  const player2CanMove = hasValidMoves(player2Cones, board);
  const isDraw = !player1CanMove && !player2CanMove;

  if (isDraw) {
    console.log("The game is a draw!");
    return { draw: true };
  }

  return null;
};

// Updated updateGameRequest function to include draw checks
exports.updateGameRequest = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { board, activePlayer, player1Cones, player2Cones, row, col, coneSize } = req.body;

    console.log('Received game update request:', { gameId, board, activePlayer, player1Cones, player2Cones, row, col, coneSize });

    const gameRequest = await GameRequest.getById(gameId);
    if (!gameRequest.joiner_id) {
      return res.status(400).json({ error: 'The game cannot start without another player.' });
    }
    if (gameRequest.status !== 'joined') {
      return res.status(400).json({ error: 'The game is not active. Please wait for another player to join.' });
    }

    // Emit gameUpdated event with the new board state before checking for a win
    const updatedBoardState = await GameRequest.updateBoard(gameId, board, activePlayer === 1 ? 2 : 1, player1Cones, player2Cones);
    socket.getIo().emit('gameUpdated', { ...updatedBoardState, gameId });
    console.log(`Emitting 'gameUpdated' event for gameId: ${gameId}`);

    // Then check for a win or draw condition
    const gameOverCondition = checkGameOverCondition(board, player1Cones, player2Cones);
    if (gameOverCondition?.winner) {
      const winnerId = gameOverCondition.winner === 1 ? gameRequest.creator_id : gameRequest.joiner_id;
      const loserId = gameOverCondition.winner === 1 ? gameRequest.joiner_id : gameRequest.creator_id;

      console.log(`Setting game as won by user ID: ${winnerId}`);
      await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', winnerId, gameId]);

      await updateUserStats(winnerId, loserId);
      socket.getIo().emit('gameWon', { gameId, winner: winnerId });
      console.log(`Emitting 'gameWon' event for gameId: ${gameId} to winnerId: ${winnerId}`);

      const updatedGameRequest = await GameRequest.getById(gameId);
      console.log('Updated GameRequest:', updatedGameRequest);
      res.json(updatedGameRequest);
    } else if (gameOverCondition?.draw) {
      console.log('Game ended in a draw.');
      await pool.query('UPDATE GameRequests SET status = $1 WHERE id = $2', ['draw', gameId]);

      await updateUserStats(gameRequest.creator_id, gameRequest.joiner_id, true);
      socket.getIo().emit('gameDraw', { gameId });
      console.log(`Emitting 'gameDraw' event for gameId: ${gameId}`);

      const updatedGameRequest = await GameRequest.getById(gameId);
      console.log('Updated GameRequest:', updatedGameRequest);
      res.json(updatedGameRequest);
    } else {
      res.json(updatedBoardState);
    }

  } catch (err) {
    console.error('Error updating game:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createGameRequest = async (req, res) => {
  try {
    const { gameType } = req.body;
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const creatorId = req.user.user_id;

    // Check if the user already has an active game request or joined game
    const existingRequests = await GameRequest.getPendingByUser(creatorId);
    const existingJoinedGames = await GameRequest.getJoinedByUser(creatorId);
    if (existingRequests.length > 0 || existingJoinedGames.length > 0) {
      return res.status(400).json({ error: 'User already has an active game request or joined game' });
    }

    const initialBoard = Array(3).fill().map(() => Array(3).fill(null));
    const player1Cones = [3, 3, 3]; // 3 cones of each size for player 1
    const player2Cones = [3, 3, 3]; // 3 cones of each size for player 2

    const gameRequest = await pool.query(
      'INSERT INTO GameRequests (creator_id, game_type, status, board, active_player, player1_cones, player2_cones) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [creatorId, gameType, 'pending', JSON.stringify(initialBoard), 1, JSON.stringify(player1Cones), JSON.stringify(player2Cones)]
    );

    socket.getIo().emit('gameRequestCreated', gameRequest.rows[0]); // Emit event
    res.status(201).json(gameRequest.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getActiveGameRequests = async (req, res) => {
  try {
    const { page = 1, limit = 25 } = req.query;

    let gameRequests = [];
    let userStats = {};
    let totalGames = 0;

    if (req.user) {
      gameRequests = await GameRequest.getGamesUserHasCreatedOrJoined(req.user.user_id, page, limit);
      totalGames = await GameRequest.getTotalGameCount(req.user.user_id);

      // Fetch user stats
      const userStatsResult = await pool.query(
        'SELECT wins, losses, draws FROM Users WHERE user_id = $1',
        [req.user.user_id]
      );
      userStats = userStatsResult.rows[0];
    }

    res.json({
      gameRequests,
      userStats,
      totalGames, // Include total game count in the response
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.joinGameRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const joinerId = req.user.user_id;

    console.log(`Player ${joinerId} attempting to join game request ${requestId}`);

    // Additional checks and logs
    const existingRequests = await GameRequest.getPendingByUser(joinerId);
    const existingJoinedGames = await GameRequest.getJoinedByUser(joinerId);
    console.log(`Existing requests: ${JSON.stringify(existingRequests)}`);
    console.log(`Existing joined games: ${JSON.stringify(existingJoinedGames)}`);

    if (existingRequests.length > 0 || existingJoinedGames.length > 0) {
      return res.status(400).json({ error: 'User already has an active game request or joined game' });
    }

    const gameRequest = await GameRequest.join(requestId, joinerId);
    console.log(`Player ${joinerId} successfully joined game request ${requestId}`);

    // Emit event when the player joins
    console.log(`Emitting playerJoined event for gameRequest: ${JSON.stringify(gameRequest)}`);
    socket.getIo().emit('playerJoined', gameRequest);

    res.json(gameRequest);
  } catch (err) {
    console.error('Error in joinGameRequest:', err.message);
    res.status(500).json({ error: err.message });
  }
};  

exports.cancelGameRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const gameRequest = await GameRequest.cancel(requestId);
    socket.getIo().emit('gameRequestCancelled', gameRequest); // Emit event
    res.json(gameRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getGameRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const gameRequest = await GameRequest.getById(requestId);

    if (!gameRequest) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const userId = req.user.user_id;
    if (gameRequest.creator_id !== userId && gameRequest.joiner_id !== userId) {
      return res.status(403).json({ error: 'Access denied: You are not part of this game' });
    }

    res.json(gameRequest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.surrenderGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    const surrenderingPlayer = req.user.user_id;

    // Fetch the game request
    const gameRequest = await GameRequest.getById(gameId);

    if (!gameRequest) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Determine the winner (the other player)
    const winner = surrenderingPlayer === gameRequest.creator_id ? gameRequest.joiner_id : gameRequest.creator_id;

    // Update the game status and emit event
    await pool.query('UPDATE GameRequests SET status = $1 WHERE id = $2', ['won', gameId]);
    socket.getIo().emit('gameSurrendered', { gameId, winner });

    res.json({ message: 'Game surrendered', winner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Function to update user statistics
const updateUserStats = async (winnerId, loserId, isDraw = false) => {
  try {
    console.log('Updating user stats... Winner:', winnerId, 'Loser:', loserId);
    // Explicitly cast the IDs to integers
    const winnerIdInt = parseInt(winnerId, 10);
    const loserIdInt = parseInt(loserId, 10);

    if (isDraw) {
      console.log(`Updating stats for draw between user ${winnerIdInt} and user ${loserIdInt}`);
      await pool.query(
        'UPDATE Users SET draws = draws + 1 WHERE user_id = CAST($1 AS INTEGER) OR user_id = CAST($2 AS INTEGER)',
        [winnerIdInt, loserIdInt]
      );
    } else {
      console.log(`Updating stats: User ${winnerIdInt} won, User ${loserIdInt} lost`);
      await pool.query(
        'UPDATE Users SET wins = wins + 1 WHERE user_id = CAST($1 AS INTEGER)',
        [winnerIdInt]
      );
      await pool.query(
        'UPDATE Users SET losses = losses + 1 WHERE user_id = CAST($1 AS INTEGER)',
        [loserIdInt]
      );
    }
    console.log('User stats updated successfully');
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};

