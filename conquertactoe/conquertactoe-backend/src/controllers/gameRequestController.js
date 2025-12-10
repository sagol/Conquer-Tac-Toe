const GameRequest = require('../models/GameRequest');
const Notification = require('../models/Notification');
const socket = require('../socket');
const pool = require('../config/db');
const { getBotMove } = require('../services/aiService');

const { checkGameOverCondition } = require('../utils/gameUtils');


// Updated updateGameRequest function to include draw checks
// Helper function to handle bot moves
const handleBotMove = async (gameId, board, player1Cones, player2Cones, variantId) => {
  try {
    console.log('Bot turn - requesting move from AI Service');

    // Fetch variant info for bot
    const GameVariant = require('../models/GameVariant');
    const variant = await GameVariant.getById(variantId || 3);

    const boardSize = variant ? variant.board_size : 3;

    // Fetch per-variant bot difficulty from settings
    const { getSetting } = require('../utils/settings');
    const difficultyKey = `bot_difficulty_variant_${variantId || 3}`;
    const defaultDifficulty = await getSetting(difficultyKey, 'hard');

    console.log(`[Bot] Using difficulty: ${defaultDifficulty} for variant ${variantId}`);

    let botMove = await getBotMove(
      gameId,
      board,
      player1Cones,
      player2Cones,
      defaultDifficulty,
      variantId || 3,
      boardSize
    );
    console.log('Bot move received:', botMove);

    // Validate bot move
    const { createRulesEngine } = require('../utils/gameRules');
    const rules = await createRulesEngine(variantId || 3);

    if (!rules.isValidMove(botMove.row, botMove.col, botMove.cone_size, board, player2Cones, 2)) {
      console.error('Bot attempted invalid move:', botMove);
      // Fallback: Try to find ANY valid move (simple random search)
      let foundValid = false;
      for (let r = 0; r < boardSize && !foundValid; r++) {
        for (let c = 0; c < boardSize; c++) {
          for (let s = player2Cones.length - 1; s >= 0; s--) {
            if (player2Cones[s] > 0 && rules.isValidMove(r, c, s, board, player2Cones, 2)) {
              botMove = { row: r, col: c, cone_size: s };
              foundValid = true;
              console.log('Fallback move found:', botMove);
              break;
            }
          }
          if (foundValid) break;
        }
        if (foundValid) break;
      }

      if (!foundValid) {
        console.error('Bot has NO valid moves!');
        return null;
      }
    }

    // Apply bot's move using already-parsed board state
    const botBoard = [...board.map(row => [...row])]; // Deep copy
    const botP2Cones = [...player2Cones];
    botBoard[botMove.row][botMove.col] = { player: 2, size: botMove.cone_size };
    // Only decrement if not unlimited marker (< 900)
    if (botP2Cones[botMove.cone_size] < 900) {
      botP2Cones[botMove.cone_size]--;
    }

    console.log('About to update board with bot move...');
    // Update game with bot's move
    const botBoardState = await GameRequest.updateBoard(
      gameId,
      botBoard,
      1, // Back to player 1's turn
      player1Cones,
      botP2Cones
    );
    console.log('Bot board state after update:', botBoardState);
    const botEmitPayload = { ...botBoardState, id: gameId, gameId: parseInt(gameId) };
    console.log('Emitting gameUpdated for bot move:', JSON.stringify(botEmitPayload, null, 2));
    socket.getIo().emit('gameUpdated', botEmitPayload);

    // Check for win/draw AFTER bot move
    console.log('ABOUT TO CHECK WIN CONDITION');
    const botGameOver = await checkGameOverCondition(botBoard, player1Cones, botP2Cones, variantId || 3);
    console.log('Bot game over result:', botGameOver);

    if (botGameOver?.winner === 2) {
      console.log('Bot won the game');
      await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', 2, gameId]);
      socket.getIo().emit('gameWon', { gameId: parseInt(gameId), winner: 2 });
      const finalGameState = await GameRequest.getById(gameId);
      return finalGameState;
    } else if (botGameOver?.draw) {
      console.log('Game ended in draw after bot move');
      await pool.query('UPDATE GameRequests SET status = $1 WHERE id = $2', ['draw', gameId]);
      socket.getIo().emit('gameDraw', { gameId: parseInt(gameId) });
      const finalGameState = await GameRequest.getById(gameId);
      return finalGameState;
    }

    return botBoardState;
  } catch (botError) {
    console.error('Bot move failed:', botError);
    return null;
  }
};

// Helper to send game result notifications
const notifyGameResult = async (gameId, winnerId, loserId, reason) => {
  try {
    // Notification and socket are already imported at module level
    let notificationMessage;

    if (reason === 'draw') {
      notificationMessage = `Game ended in a draw!|game_id:${gameId}`;
      if (winnerId) { // user1
        const notif1 = await Notification.create(winnerId, 'game_draw', notificationMessage);
        socket.getIo().to(`user_${winnerId}`).emit('notification', notif1);
      }
      if (loserId) { // user2
        const notif2 = await Notification.create(loserId, 'game_draw', notificationMessage);
        socket.getIo().to(`user_${loserId}`).emit('notification', notif2);
      }
      console.log(`Sent 'game_draw' notifications for game ${gameId}`);
      return;
    }

    // Win/Loss scenario
    if (winnerId) {
      // 1. Notify Winner
      try {
        let winMsg = `You won the game!|game_id:${gameId}`;
        if (reason === 'surrender') winMsg = `Your opponent surrendered! You won!|game_id:${gameId}`;
        else if (reason === 'timeout') winMsg = `Your opponent ran out of time! You won!|game_id:${gameId}`;

        const winNotif = await Notification.create(winnerId, 'game_won', winMsg);
        socket.getIo().to(`user_${winnerId}`).emit('notification', winNotif);
        console.log(`Sent 'game_won' notification to winner ${winnerId}`);
      } catch (e) {
        console.error('Failed to notify winner:', e);
      }

      // 2. Notify Loser
      if (loserId) {
        try {
          // Fetch winner's name for friendlier message
          let winnerName = 'your opponent';
          const winnerResult = await pool.query('SELECT username FROM Users WHERE user_id = CAST($1 AS INTEGER)', [winnerId]);
          if (winnerResult.rows.length > 0) winnerName = winnerResult.rows[0].username;

          let loseMsg = `Game Over - You lost to ${winnerName}.|game_id:${gameId}`;
          if (reason === 'timeout') loseMsg = `Time's up! You lost to ${winnerName}.|game_id:${gameId}`;

          const loseNotif = await Notification.create(loserId, 'game_lost', loseMsg);
          socket.getIo().to(`user_${loserId}`).emit('notification', loseNotif);
          console.log(`Sent 'game_lost' notification to loser ${loserId}`);
        } catch (e) {
          console.error('Failed to notify loser:', e);
        }
      }
    }
  } catch (err) {
    console.error('Error in notifyGameResult:', err);
  }
};

exports.updateGameRequest = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { board, activePlayer, player1Cones, player2Cones, row, col, coneSize } = req.body;

    console.log('Received game update request:', { gameId, board, activePlayer, player1Cones, player2Cones, row, col, coneSize });

    const gameRequest = await GameRequest.getById(gameId);
    if (!gameRequest) {
      return res.status(404).json({ error: 'Game not found' });
    }
    console.log('Game request details:', { joiner_id: gameRequest.joiner_id, game_type: gameRequest.game_type, status: gameRequest.status });
    if (!gameRequest.joiner_id && gameRequest.game_type !== 'bot') {
      return res.status(400).json({ error: 'The game cannot start without another player.' });
    }
    if (gameRequest.status !== 'joined') {
      return res.status(400).json({ error: 'The game is not active. Please wait for another player to join.' });
    }

    // Validate the player's move before applying
    const { createRulesEngine } = require('../utils/gameRules');
    const rules = await createRulesEngine(gameRequest.variant_id || 3);
    const playerNumber = activePlayer; // Current active player making the move
    const playerCones = activePlayer === 1 ? player1Cones : player2Cones;

    const cellAtPosition = board[row][col];
    console.log('DEBUG: Validating move:', { row, col, coneSize, playerNumber, cellAtPosition });

    if (!rules.isValidMove(row, col, coneSize, board, playerCones, playerNumber)) {
      console.error('Invalid move attempt:', { row, col, coneSize, playerNumber, cellAtPosition });
      return res.status(400).json({ error: 'Invalid move: Cannot place cone at this position.' });
    }

    // Log move to ClickHouse
    const clickhouseService = require('../services/clickhouseService');
    // Determine difficulty label
    let difficultyLabel = 'pvp';
    if (gameRequest.game_type === 'bot') {
      difficultyLabel = gameRequest.bot_difficulty || 'medium';
    }

    // In PvP: player1Cones is Player 1, player2Cones is Player 2
    // We map player2Cones to 'bot_cones' field for schema compatibility
    clickhouseService.logMove({
      gameId,
      board, // State BEFORE move
      playerCones: player1Cones,
      botCones: player2Cones,
      move: { row, col, coneSize },
      difficulty: difficultyLabel,
      variantId: gameRequest.variant_id || 3,
      boardSize: board.length
    });

    // CRITICAL FIX: Apply the player's move to the board BEFORE updating
    const updatedBoard = board.map((r, rowIndex) =>
      r.map((cell, colIndex) => {
        if (rowIndex === row && colIndex === col) {
          return { player: playerNumber, size: coneSize };
        }
        return cell;
      })
    );

    // Update player's cones
    const updatedPlayerCones = [...playerCones];
    updatedPlayerCones[coneSize] -= 1;

    const newPlayer1Cones = activePlayer === 1 ? updatedPlayerCones : player1Cones;
    const newPlayer2Cones = activePlayer === 2 ? updatedPlayerCones : player2Cones;

    // CRITICAL FIX: Check for win/draw BEFORE switching active player
    // This ensures the game state reflects the winning player correctly
    const gameOverCondition = await checkGameOverCondition(updatedBoard, newPlayer1Cones, newPlayer2Cones, gameRequest.variant_id || 3);

    // Determine next active player (only if game continues)
    const nextActivePlayer = gameOverCondition ? activePlayer : (activePlayer === 1 ? 2 : 1);

    // Update board with correct active player
    const updatedBoardState = await GameRequest.updateBoard(gameId, updatedBoard, nextActivePlayer, newPlayer1Cones, newPlayer2Cones);
    socket.getIo().emit('gameUpdated', { ...updatedBoardState, id: gameId, gameId: parseInt(gameId) });
    console.log(`Emitting 'gameUpdated' event for gameId: ${gameId}`);

    // Handle win condition
    if (gameOverCondition?.winner) {
      let winnerId, loserId, winnerFieldValue;
      if (gameRequest.game_type === 'bot') {
        // Bot game: Store PLAYER NUMBER (1 or 2) in winner field for frontend
        // But track user_id for stats
        winnerFieldValue = gameOverCondition.winner; // 1 or 2
        winnerId = gameOverCondition.winner === 1 ? gameRequest.creator_id : null;
        loserId = gameOverCondition.winner === 2 ? gameRequest.creator_id : null;
      } else {
        // PvP game: Store user_id in winner field
        winnerId = gameOverCondition.winner === 1 ? gameRequest.creator_id : gameRequest.joiner_id;
        loserId = gameOverCondition.winner === 1 ? gameRequest.joiner_id : gameRequest.creator_id;
        winnerFieldValue = winnerId;
      }

      console.log(`Setting game as won - Winner: ${winnerFieldValue} (bot game: ${gameRequest.game_type === 'bot'})`);
      await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', winnerFieldValue, gameId]);

      await updateUserStats(winnerId, loserId);
      socket.getIo().emit('gameWon', { gameId: parseInt(gameId), winner: winnerFieldValue });
      console.log(`Emitting 'gameWon' event for gameId: ${gameId} to winner: ${winnerFieldValue}`);

      // Send game result notifications to both players in PvP games
      if (gameRequest.game_type !== 'bot') {
        await notifyGameResult(gameId, winnerId, loserId, 'win');
      }

      const finalGameState = await GameRequest.getById(gameId);
      res.json(finalGameState);
    } else if (gameOverCondition?.draw) {
      console.log('Game ended in a draw.');
      await pool.query('UPDATE GameRequests SET status = $1 WHERE id = $2', ['draw', gameId]);

      await updateUserStats(gameRequest.creator_id, gameRequest.joiner_id, true);
      socket.getIo().emit('gameDraw', { gameId: parseInt(gameId) });
      console.log(`Emitting 'gameDraw' event for gameId: ${gameId}`);

      // Send notification to both players in PvP games about the draw
      if (gameRequest.game_type !== 'bot') {
        await notifyGameResult(gameId, gameRequest.creator_id, gameRequest.joiner_id, 'draw');
      }

      const finalGameState = await GameRequest.getById(gameId);
      res.json(finalGameState);

    } else {
      console.log('No win/draw after player move. Checking for bot turn...');
      console.log('Game type:', gameRequest.game_type, 'Active player:', updatedBoardState.active_player);

      // Send notification to the next active player in PvP games that it's their turn
      if (gameRequest.game_type !== 'bot' && gameRequest.joiner_id) {
        try {
          // Determine who the next player is (the player who should move next, which is updatedBoardState.active_player)
          const opponentId = updatedBoardState.active_player === 1 ? gameRequest.creator_id : gameRequest.joiner_id;
          const notificationMessage = `It's your turn!|game_id:${gameId}`;
          const notification = await Notification.create(opponentId, 'your_turn', notificationMessage);

          // Emit real-time notification to opponent
          socket.getIo().to(`user_${opponentId}`).emit('notification', notification);
          console.log(`Sent 'your_turn' notification to user ${opponentId} for game ${gameId}`);
        } catch (notificationError) {
          console.error('Failed to create move notification:', notificationError);
        }
      }

      // If it's a bot game and now it's the bot's turn (player 2), get bot's move
      if (gameRequest.game_type === 'bot' && updatedBoardState.active_player === 2) {
        const currentBoard = typeof updatedBoardState.board === 'string'
          ? JSON.parse(updatedBoardState.board)
          : updatedBoardState.board;
        const currentP1Cones = typeof updatedBoardState.player1_cones === 'string'
          ? JSON.parse(updatedBoardState.player1_cones)
          : updatedBoardState.player1_cones;
        const currentP2Cones = typeof updatedBoardState.player2_cones === 'string'
          ? JSON.parse(updatedBoardState.player2_cones)
          : updatedBoardState.player2_cones;

        const botResult = await handleBotMove(gameId, currentBoard, currentP1Cones, currentP2Cones, gameRequest.variant_id);
        res.json(botResult || updatedBoardState);
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
    const { gameType, variantId = 3 } = req.body; // Default to Classic Conquer
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if game creation is allowed
    const { getBooleanSetting } = require('../utils/settings');
    const allowGameCreation = await getBooleanSetting('game_creation', true);
    if (!allowGameCreation) {
      return res.status(403).json({ error: 'Game creation is currently disabled' });
    }

    const creatorId = req.user.user_id;

    // Check max active games limit
    const { getNumberSetting, getSetting } = require('../utils/settings');
    const maxActiveGames = await getNumberSetting('max_active_games_per_user', 5);

    const existingRequests = await GameRequest.getPendingByUser(creatorId);
    const existingJoinedGames = await GameRequest.getJoinedByUser(creatorId);

    if ((existingRequests.length + existingJoinedGames.length) >= maxActiveGames) {
      return res.status(400).json({ error: `You have reached the maximum limit of ${maxActiveGames} active games.` });
    }

    // Fetch variant configuration
    const GameVariant = require('../models/GameVariant');
    const variant = await GameVariant.getById(variantId);

    if (!variant) {
      return res.status(400).json({ error: 'Invalid variant ID' });
    }

    // Initialize board and cones based on variant
    const boardSize = variant.board_size;
    const initialBoard = Array(boardSize).fill().map(() => Array(boardSize).fill(null));
    const player1Cones = variant.player1_cones;
    const player2Cones = variant.player2_cones;

    const gameRequest = await pool.query(
      'INSERT INTO GameRequests (creator_id, game_type, variant_id, status, board, active_player, player1_cones, player2_cones) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [creatorId, gameType, variantId, 'pending', JSON.stringify(initialBoard), 1, JSON.stringify(player1Cones), JSON.stringify(player2Cones)]
    );

    socket.getIo().emit('gameRequestCreated', gameRequest.rows[0]); // Emit event
    res.status(201).json(gameRequest.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createBotGameRequest = async (req, res) => {
  try {
    const { variantId = 3, botDifficulty } = req.body; // Accept bot difficulty from frontend
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if game creation is allowed
    const { getBooleanSetting, getNumberSetting, getSetting } = require('../utils/settings');
    const allowGameCreation = await getBooleanSetting('game_creation', true);
    if (!allowGameCreation) {
      return res.status(403).json({ error: 'Game creation is currently disabled' });
    }

    const creatorId = req.user.user_id;

    // Fetch variant configuration
    const GameVariant = require('../models/GameVariant');
    const variant = await GameVariant.getById(variantId);

    if (!variant) {
      return res.status(400).json({ error: 'Invalid variant ID' });
    }

    // Initialize board and cones based on variant
    // Allow custom board size for Gomoku (variant 2)
    let boardSize = variant.board_size;
    if (req.body.boardSize && parseInt(variantId) === 2) {
      boardSize = parseInt(req.body.boardSize);
      console.log(`Using custom board size: ${boardSize} for Gomoku`);
    }

    const initialBoard = Array(boardSize).fill().map(() => Array(boardSize).fill(null));
    let player1Cones = variant.player1_cones;
    let player2Cones = variant.player2_cones;

    console.log('DEBUG: req.body =', JSON.stringify(req.body));
    console.log('DEBUG: variantId =', variantId, typeof variantId);

    // Get difficulty (user override or admin default)
    let difficulty = botDifficulty;
    if (!difficulty) {
      const difficultyKey = `bot_difficulty_variant_${variantId}`;
      difficulty = await getSetting(difficultyKey, 'hard');
    }
    console.log(`[Bot Game] Using difficulty: ${difficulty} for variant ${variantId}`);

    // Handle custom cones for Conquer Custom variant (ID 5)
    const { customCones } = req.body;
    console.log('DEBUG: customCones =', customCones);
    if (parseInt(variantId) === 5 && customCones) {
      console.log('Applying custom cones:', customCones);
      player1Cones = [
        customCones.small || 0,
        customCones.medium || 0,
        customCones.large || 0
      ];
      player2Cones = [...player1Cones]; // Bot gets same inventory
      console.log('Custom cones applied:', player1Cones);
    }

    const randomValue = Math.random();
    const startingPlayer = randomValue < 0.5 ? 1 : 2;
    console.log(`[Randomization] Random value: ${randomValue.toFixed(4)}, Starting player: ${startingPlayer}`);

    const gameRequest = await pool.query(
      'INSERT INTO GameRequests (creator_id, game_type, variant_id, status, board, active_player, player1_cones, player2_cones, joiner_id, bot_difficulty) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [creatorId, 'bot', variantId, 'joined', JSON.stringify(initialBoard), startingPlayer, JSON.stringify(player1Cones), JSON.stringify(player2Cones), null, difficulty]
    );

    const createdGame = gameRequest.rows[0];

    // If bot starts (active_player === 2), trigger bot move immediately
    // The frontend handles animation timing by freezing the board during randomization
    if (createdGame.active_player === 2) {
      console.log('Bot starts! Triggering bot move immediately (frontend handles animation timing)');

      // No delay needed - frontend will show frozen board during randomization overlay
      handleBotMove(
        createdGame.id,
        initialBoard,
        player1Cones,
        player2Cones,
        variantId
      ).catch(err => console.error('Error in initial bot move:', err));
    }

    res.status(201).json(createdGame);
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
    // Fetch the game request to validate
    const gameToJoin = await GameRequest.getById(requestId);
    if (!gameToJoin) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (gameToJoin.status !== 'pending') {
      return res.status(400).json({ error: 'Game is no longer available to join' });
    }

    // Prevent joining own game
    if (gameToJoin.creator_id === joinerId) {
      return res.status(400).json({ error: 'You cannot join your own game.' });
    }

    // Check max active games limit for joiner
    const { getNumberSetting } = require('../utils/settings');
    const maxActiveGames = await getNumberSetting('max_active_games_per_user', 5);

    const existingRequests = await GameRequest.getPendingByUser(joinerId);
    const existingJoinedGames = await GameRequest.getJoinedByUser(joinerId);
    console.log(`Existing requests: ${JSON.stringify(existingRequests)}`);
    console.log(`Existing joined games: ${JSON.stringify(existingJoinedGames)}`);

    if ((existingRequests.length + existingJoinedGames.length) >= maxActiveGames) {
      return res.status(400).json({ error: `You have reached the maximum limit of ${maxActiveGames} active games.` });
    }

    // Randomize starting player (1 or 2)
    const startingPlayer = Math.random() < 0.5 ? 1 : 2;
    console.log(`Randomized starting player for game ${requestId}: Player ${startingPlayer}`);

    const gameRequest = await GameRequest.join(requestId, joinerId, startingPlayer);
    console.log(`Player ${joinerId} successfully joined game request ${requestId}`);

    // Emit event when the player joins
    console.log(`Emitting playerJoined event for gameRequest: ${JSON.stringify(gameRequest)}`);
    socket.getIo().emit('playerJoined', gameRequest);

    // Create notification for the game creator (non-blocking)
    try {
      const notificationMessage = `A player has joined your game!|game_id:${requestId}`;
      const notification = await Notification.create(gameRequest.creator_id, 'game_join', notificationMessage);

      // Emit real-time notification to creator
      socket.getIo().to(`user_${gameRequest.creator_id}`).emit('notification', notification);
    } catch (notificationError) {
      console.error('Failed to create or emit notification:', notificationError);
    }

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

    // FIX: Auto-trigger bot move if it's a bot game and it's bot's turn
    // This prevents bot from being stuck after page reload
    if (gameRequest.game_type === 'bot' &&
      gameRequest.active_player === 2 &&
      gameRequest.status === 'joined') {

      console.log(`[GET Game ${requestId}] Bot's turn detected, auto-triggering bot move...`);

      try {
        // Parse game state
        const board = typeof gameRequest.board === 'string'
          ? JSON.parse(gameRequest.board)
          : gameRequest.board;
        const player1Cones = typeof gameRequest.player1_cones === 'string'
          ? JSON.parse(gameRequest.player1_cones)
          : gameRequest.player1_cones;
        const player2Cones = typeof gameRequest.player2_cones === 'string'
          ? JSON.parse(gameRequest.player2_cones)
          : gameRequest.player2_cones;

        // Trigger bot move
        const botResult = await handleBotMove(
          requestId,
          board,
          player1Cones,
          player2Cones,
          gameRequest.variant_id
        );

        // Return updated game state after bot move
        if (botResult) {
          return res.json(botResult);
        }
      } catch (botError) {
        console.error(`[GET Game ${requestId}] Bot move failed:`, botError);
        // Continue to return current game state if bot move fails
      }
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

    // Verify the surrendering player is part of this game
    if (gameRequest.creator_id !== surrenderingPlayer && gameRequest.joiner_id !== surrenderingPlayer) {
      return res.status(403).json({ error: 'You are not part of this game' });
    }

    // Determine the winner (the OTHER player - the one NOT surrendering)
    const winner = surrenderingPlayer === gameRequest.creator_id ? gameRequest.joiner_id : gameRequest.creator_id;
    const loser = surrenderingPlayer;

    console.log(`Player ${surrenderingPlayer} surrendered game ${gameId}. Winner: ${winner}`);

    // Update the game status AND set winner (this was the bug - winner wasn't being saved)
    await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', winner, gameId]);

    // Update user stats
    await updateUserStats(winner, loser);

    // Emit surrender event to specific users instead of globally
    if (gameRequest.creator_id) socket.getIo().to(`user_${gameRequest.creator_id}`).emit('gameSurrendered', { gameId: parseInt(gameId), winner });
    if (gameRequest.joiner_id) socket.getIo().to(`user_${gameRequest.joiner_id}`).emit('gameSurrendered', { gameId: parseInt(gameId), winner });

    // Send notification to the winner (for PvP games)
    if (gameRequest.game_type !== 'bot') {
      // Note: Helper expects (gameId, winnerId, loserId, reason)
      // We pass null for loserId because surrendering player knows they lost (no need for active notification usually)
      // Or we can notify them too. The previous logic only notified winner.
      // Let's stick to previous logic: notify winner only, or notify both?
      // Helper notifies both if provided. Let's pass null for loserId to match old behavior (waiting for winner notif).
      // Actually, let's just use the helper fully, maybe notifying the loser "You surrendered" isn't bad?
      // The original code only notified winner.
      // If we use the helper, it tries to notify loser if ID provided.
      // To matching existing behavior exactly:
      await notifyGameResult(gameId, winner, null, 'surrender');
    }

    res.json({ message: 'Game surrendered', winner });
  } catch (err) {
    console.error('Error in surrenderGame:', err);
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
      if (!isNaN(winnerIdInt)) {
        console.log(`Updating stats: User ${winnerIdInt} won`);
        await pool.query(
          'UPDATE Users SET wins = wins + 1 WHERE user_id = CAST($1 AS INTEGER)',
          [winnerIdInt]
        );
      }

      if (!isNaN(loserIdInt)) {
        console.log(`Updating stats: User ${loserIdInt} lost`);
        await pool.query(
          'UPDATE Users SET losses = losses + 1 WHERE user_id = CAST($1 AS INTEGER)',
          [loserIdInt]
        );
      }
    }
    console.log('User stats updated successfully');
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};

// Internal function to reset a game (called by Admin Dashboard)
exports.resetGame = async (req, res) => {
  try {
    const { gameId } = req.params;
    console.log(`[Internal] Resetting game ${gameId}`);

    const gameRequest = await GameRequest.getById(gameId);
    if (!gameRequest) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Fetch variant configuration to reset cones
    const GameVariant = require('../models/GameVariant');
    const variant = await GameVariant.getById(gameRequest.variant_id);

    // Determine board size (handle custom size for Gomoku if applicable)
    // For reset, we should probably keep the existing board size if possible, 
    // but the board is stored as JSON. We can check the current board size.
    let boardSize = variant.board_size;
    if (gameRequest.board) {
      const currentBoard = typeof gameRequest.board === 'string' ? JSON.parse(gameRequest.board) : gameRequest.board;
      if (currentBoard && currentBoard.length > 0) {
        boardSize = currentBoard.length;
      }
    }

    const initialBoard = Array(boardSize).fill().map(() => Array(boardSize).fill(null));

    // Reset cones
    // Note: If it was a custom cone game, we might lose that info unless we stored it.
    // For now, reset to variant defaults.
    const player1Cones = variant.player1_cones;
    const player2Cones = variant.player2_cones;

    // Randomize starting player
    const startingPlayer = Math.random() < 0.5 ? 1 : 2;
    console.log(`[Reset] Game ${gameId} reset. Starting player: ${startingPlayer}`);

    const newStatus = (gameRequest.joiner_id || gameRequest.game_type === 'bot') ? 'joined' : 'pending';

    // Update DB
    const updatedGame = await pool.query(`
        UPDATE gamerequests 
        SET 
            board = $1, 
            status = $2, 
            active_player = $3, 
            winner = NULL, 
            player1_cones = $4, 
            player2_cones = $5,
            created_at = NOW()
        WHERE id = $6
        RETURNING *
    `, [
      JSON.stringify(initialBoard),
      newStatus,
      startingPlayer,
      JSON.stringify(player1Cones),
      JSON.stringify(player2Cones),
      gameId
    ]);

    const resetGame = updatedGame.rows[0];

    // Emit update to clients
    socket.getIo().emit('gameUpdated', { ...resetGame, id: gameId, gameId: parseInt(gameId) });

    // If it's a bot game and bot starts, trigger move
    if (gameRequest.game_type === 'bot' && startingPlayer === 2) {
      console.log('[Reset] Bot starts! Triggering move...');
      // We can't await this if we want to return quickly, but for internal API it's fine to wait or not.
      // Better to not await to avoid timeout if bot takes long, but handleBotMove is async.
      handleBotMove(
        gameId,
        initialBoard,
        player1Cones,
        player2Cones,
        gameRequest.variant_id
      ).catch(err => console.error('Error in reset bot move:', err));
    }

    res.json({ message: 'Game reset successfully', game: resetGame });

  } catch (err) {
    console.error('Error resetting game:', err);
    res.status(500).json({ error: err.message });
  }
};
