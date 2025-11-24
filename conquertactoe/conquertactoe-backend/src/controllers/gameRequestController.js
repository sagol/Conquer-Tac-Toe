const GameRequest = require('../models/GameRequest');
const socket = require('../socket');
const pool = require('../config/db');
const { getBotMove } = require('../services/aiService');

const { checkGameOverCondition } = require('../utils/gameUtils');


// Updated updateGameRequest function to include draw checks
exports.updateGameRequest = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { board, activePlayer, player1Cones, player2Cones, row, col, coneSize } = req.body;

    console.log('Received game update request:', { gameId, board, activePlayer, player1Cones, player2Cones, row, col, coneSize });

    const gameRequest = await GameRequest.getById(gameId);
    console.log('Game request details:', { joiner_id: gameRequest.joiner_id, game_type: gameRequest.game_type, status: gameRequest.status });
    if (!gameRequest.joiner_id && gameRequest.game_type !== 'bot') {
      return res.status(400).json({ error: 'The game cannot start without another player.' });
    }
    if (gameRequest.status !== 'joined') {
      return res.status(400).json({ error: 'The game is not active. Please wait for another player to join.' });
    }

    // Emit gameUpdated event with the new board state before checking for a win
    const updatedBoardState = await GameRequest.updateBoard(gameId, board, activePlayer === 1 ? 2 : 1, player1Cones, player2Cones);
    socket.getIo().emit('gameUpdated', { ...updatedBoardState, id: gameId, gameId: parseInt(gameId) });
    console.log(`Emitting 'gameUpdated' event for gameId: ${gameId}`);

    // Then check for a win or draw condition
    const gameOverCondition = checkGameOverCondition(board, player1Cones, player2Cones);
    if (gameOverCondition?.winner) {
      const winnerId = gameOverCondition.winner === 1 ? gameRequest.creator_id : gameRequest.joiner_id;
      const loserId = gameOverCondition.winner === 1 ? gameRequest.joiner_id : gameRequest.creator_id;

      console.log(`Setting game as won by user ID: ${winnerId}`);
      await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', winnerId, gameId]);

      await updateUserStats(winnerId, loserId);
      socket.getIo().emit('gameWon', { gameId: parseInt(gameId), winner: winnerId });
      console.log(`Emitting 'gameWon' event for gameId: ${gameId} to winnerId: ${winnerId}`);

      const updatedGameRequest = await GameRequest.getById(gameId);
      console.log('Updated GameRequest:', updatedGameRequest);
      res.json(updatedGameRequest);
    } else if (gameOverCondition?.draw) {
      console.log('Game ended in a draw.');
      await pool.query('UPDATE GameRequests SET status = $1 WHERE id = $2', ['draw', gameId]);

      await updateUserStats(gameRequest.creator_id, gameRequest.joiner_id, true);
      socket.getIo().emit('gameDraw', { gameId: parseInt(gameId) });
      console.log(`Emitting 'gameDraw' event for gameId: ${gameId}`);

      const updatedGameRequest = await GameRequest.getById(gameId);
      console.log('Updated GameRequest:', updatedGameRequest);
      res.json(updatedGameRequest);
    } else {
      console.log('No win/draw after player move. Checking for bot turn...');
      console.log('Game type:', gameRequest.game_type, 'Active player:', updatedBoardState.active_player);
      // If it's a bot game and now it's the bot's turn (player 2), get bot's move
      if (gameRequest.game_type === 'bot' && updatedBoardState.active_player === 2) {
        console.log('Bot turn - requesting move from AI Service');
        try {
          // Safely parse the board state
          const currentBoard = typeof updatedBoardState.board === 'string'
            ? JSON.parse(updatedBoardState.board)
            : updatedBoardState.board;
          const currentP1Cones = typeof updatedBoardState.player1_cones === 'string'
            ? JSON.parse(updatedBoardState.player1_cones)
            : updatedBoardState.player1_cones;
          const currentP2Cones = typeof updatedBoardState.player2_cones === 'string'
            ? JSON.parse(updatedBoardState.player2_cones)
            : updatedBoardState.player2_cones;

          const botMove = await getBotMove(
            gameId,
            currentBoard,
            currentP1Cones,
            currentP2Cones,
            'medium'
          );
          console.log('Bot move received:', botMove);

          // Apply bot's move using already-parsed board state
          const botBoard = [...currentBoard.map(row => [...row])]; // Deep copy
          const botP2Cones = [...currentP2Cones];
          botBoard[botMove.row][botMove.col] = { player: 2, size: botMove.cone_size };
          botP2Cones[botMove.cone_size]--;

          console.log('About to update board with bot move...');
          // Update game with bot's move
          const botBoardState = await GameRequest.updateBoard(
            gameId,
            botBoard,
            1, // Back to player 1's turn
            currentP1Cones,
            botP2Cones
          );
          console.log('Bot board state after update:', botBoardState);
          const botEmitPayload = { ...botBoardState, id: gameId, gameId: parseInt(gameId) };
          console.log('Emitting gameUpdated for bot move:', JSON.stringify(botEmitPayload, null, 2));
          socket.getIo().emit('gameUpdated', botEmitPayload);

          // Check for win/draw AFTER bot move
          console.log('ABOUT TO CHECK WIN CONDITION');
          console.log('Bot Board:', JSON.stringify(botBoard));
          const botGameOver = checkGameOverCondition(botBoard, currentP1Cones, botP2Cones);
          console.log('Win Condition Result:', botGameOver);
          console.log('Bot game over result:', botGameOver);
          if (botGameOver?.winner === 2) {
            console.log('Bot won the game');
            await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', null, gameId]);
            socket.getIo().emit('gameWon', { gameId: parseInt(gameId), winner: null }); // null = bot won
            const finalGameState = await GameRequest.getById(gameId);
            return res.json(finalGameState);
          } else if (botGameOver?.draw) {
            console.log('Game ended in draw after bot move');
            await pool.query('UPDATE GameRequests SET status = $1 WHERE id = $2', ['draw', gameId]);
            socket.getIo().emit('gameDraw', { gameId: parseInt(gameId) });
            const finalGameState = await GameRequest.getById(gameId);
            return res.json(finalGameState);
          }

          res.json(botBoardState);
        } catch (botError) {
          console.error('Bot move failed:', botError);
          res.json(updatedBoardState); // Continue without bot move
        }
      } else {
        res.json(updatedBoardState);
      }
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

exports.createBotGameRequest = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const creatorId = req.user.user_id;

    const initialBoard = Array(3).fill().map(() => Array(3).fill(null));
    const player1Cones = [3, 3, 3];
    const player2Cones = [3, 3, 3];

    const gameRequest = await pool.query(
      'INSERT INTO GameRequests (creator_id, game_type, status, board, active_player, player1_cones, player2_cones, joiner_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [creatorId, 'bot', 'joined', JSON.stringify(initialBoard), 1, JSON.stringify(player1Cones), JSON.stringify(player2Cones), null]
    );

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
      gameRequests = await GameRequest.getLobbyGames(req.user.user_id, page, limit);
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

