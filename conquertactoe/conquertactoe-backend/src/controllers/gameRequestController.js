const GameRequest = require('../models/GameRequest');
const Notification = require('../models/Notification');
const socket = require('../socket');
const pool = require('../config/db');
const { getBotMove } = require('../services/aiService');

const { checkGameOverCondition } = require('../utils/gameUtils');

const DEFAULT_VARIANT_ID = 3; // Classic Conquer

// Helper function to handle bot moves
const handleBotMove = async (gameId, board, player1Cones, player2Cones, variantId) => {
  try {

    // Fetch variant info for bot
    const GameVariant = require('../models/GameVariant');
    const variant = await GameVariant.getById(variantId || DEFAULT_VARIANT_ID);

    const boardSize = variant ? variant.board_size : 3;

    // Fetch per-variant bot difficulty from settings
    const { getSetting } = require('../utils/settings');
    const difficultyKey = `bot_difficulty_variant_${variantId || DEFAULT_VARIANT_ID}`;
    const defaultDifficulty = await getSetting(difficultyKey, 'hard');


    let botMove = await getBotMove(
      gameId,
      board,
      player1Cones,
      player2Cones,
      defaultDifficulty,
      variantId || DEFAULT_VARIANT_ID,
      boardSize
    );

    // Validate bot move
    const { createRulesEngine } = require('../utils/gameRules');
    const rules = await createRulesEngine(variantId || DEFAULT_VARIANT_ID);

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

    // Update game with bot's move
    const botBoardState = await GameRequest.updateBoard(
      gameId,
      botBoard,
      1, // Back to player 1's turn
      player1Cones,
      botP2Cones,
      { row: botMove.row, col: botMove.col }
    );
    const botEmitPayload = { ...botBoardState, id: gameId, gameId: parseInt(gameId) };
    socket.getIo().emit('gameUpdated', botEmitPayload);

    // Check for win/draw AFTER bot move
    const botGameOver = await checkGameOverCondition(botBoard, player1Cones, botP2Cones, variantId || DEFAULT_VARIANT_ID);

    if (botGameOver?.winner === 2) {
      await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', 2, gameId]);
      socket.getIo().emit('gameWon', { gameId: parseInt(gameId), winner: 2 });
      const finalGameState = await GameRequest.getById(gameId);
      return finalGameState;
    } else if (botGameOver?.draw) {
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

/**
 * Notify both players of a draw result.
 * @param {string} gameId
 * @param {string} player1Id
 * @param {string} player2Id
 */
const notifyGameDraw = async (gameId, player1Id, player2Id) => {
  try {
    // NOTIFICATION FORMAT: message_text|game_id:value
    // Using pipe (|) delimiter is intentional for backward compatibility with existing
    // frontend parsing logic in NotificationList.js. While JSON would be more flexible,
    // this simple format is sufficient for current needs and matches the established pattern.
    // Safety: All message texts are hardcoded strings that don't contain pipes.
    // If user-generated content is added to messages in the future, migrate to JSON format.
    // Future consideration: migrate to structured metadata field if notification types expand.
    const notificationMessage = `Game ended in a draw!|game_id:${gameId}`;
    if (player1Id) {
      const notif1 = await Notification.create(player1Id, 'game_draw', notificationMessage);
      socket.getIo().to(`user_${player1Id}`).emit('notification', notif1);
    }
    if (player2Id) {
      const notif2 = await Notification.create(player2Id, 'game_draw', notificationMessage);
      socket.getIo().to(`user_${player2Id}`).emit('notification', notif2);
    }
  } catch (err) {
    console.error('Error in notifyGameDraw:', err);
  }
};

/**
 * Notify winner and loser of a win/loss result.
 * @param {string} gameId
 * @param {string} winnerId
 * @param {string} loserId
 * @param {string} reason
 */
const notifyGameWin = async (gameId, winnerId, loserId, reason) => {
  try {
    // 1. Notify Winner (only if not viewing game board)
    if (winnerId) {
      try {
        // Check if winner is viewing the game - don't spam notifications
        if (!(socket.isUserViewingGame && socket.isUserViewingGame(winnerId, gameId))) {
          let winMsg = `You won the game!|game_id:${gameId}`;
          if (reason === 'surrender') winMsg = `Your opponent surrendered! You won!|game_id:${gameId}`;
          else if (reason === 'timeout') winMsg = `Your opponent ran out of time! You won!|game_id:${gameId}`;

          const winNotif = await Notification.create(winnerId, 'game_won', winMsg);
          socket.getIo().to(`user_${winnerId}`).emit('notification', winNotif);
        }
      } catch (e) {
        console.error('Failed to notify winner:', e);
      }
    }

    // 2. Notify Loser (only if not viewing game board)
    if (loserId) {
      try {
        // Check if loser is viewing the game - don't spam notifications
        if (!(socket.isUserViewingGame && socket.isUserViewingGame(loserId, gameId))) {
          // Fetch winner's name for friendlier message
          let winnerName = 'your opponent';
          if (winnerId) {
            const winnerResult = await pool.query('SELECT username FROM Users WHERE user_id = $1', [winnerId]);
            if (winnerResult.rows.length > 0) winnerName = winnerResult.rows[0].username;
          }

          let loseMsg = `Game Over - You lost to ${winnerName}|game_id:${gameId}`;
          if (reason === 'timeout') loseMsg = `Time's up! You lost to ${winnerName}|game_id:${gameId}`;

          const loseNotif = await Notification.create(loserId, 'game_lost', loseMsg);
          socket.getIo().to(`user_${loserId}`).emit('notification', loseNotif);
        }
      } catch (e) {
        console.error('Failed to notify loser:', e);
      }
    }
  } catch (err) {
    // Log error but do not throw - notifications are non-critical
    console.error('Error in notifyGameWin:', err);
  }
};



exports.updateGameRequest = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { board, activePlayer, player1Cones, player2Cones, row, col, coneSize } = req.body;


    const gameRequest = await GameRequest.getById(gameId);
    if (!gameRequest) {
      return res.status(404).json({ error: 'Game not found' });
    }
    if (!gameRequest.joiner_id && gameRequest.game_type !== 'bot') {
      return res.status(400).json({ error: 'The game cannot start without another player.' });
    }
    if (gameRequest.status !== 'joined') {
      return res.status(400).json({ error: 'The game is not active. Please wait for another player to join.' });
    }

    // Validate the player's move before applying
    const { createRulesEngine } = require('../utils/gameRules');
    const rules = await createRulesEngine(gameRequest.variant_id || DEFAULT_VARIANT_ID);
    const playerNumber = activePlayer; // Current active player making the move
    const playerCones = activePlayer === 1 ? player1Cones : player2Cones;

    const cellAtPosition = board[row][col];

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
      variantId: gameRequest.variant_id || DEFAULT_VARIANT_ID,
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
    const gameOverCondition = await checkGameOverCondition(updatedBoard, newPlayer1Cones, newPlayer2Cones, gameRequest.variant_id || DEFAULT_VARIANT_ID);

    // Determine next active player (only if game continues)
    const nextActivePlayer = gameOverCondition ? activePlayer : (activePlayer === 1 ? 2 : 1);

    // Update board with correct active player
    const updatedBoardState = await GameRequest.updateBoard(gameId, updatedBoard, nextActivePlayer, newPlayer1Cones, newPlayer2Cones, { row, col });
    socket.getIo().emit('gameUpdated', { ...updatedBoardState, id: gameId, gameId: parseInt(gameId) });

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

      await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', winnerFieldValue, gameId]);

      await updateUserStats(winnerId, loserId);
      socket.getIo().emit('gameWon', { gameId: parseInt(gameId), winner: winnerFieldValue });

      // Send game result notifications to both players in PvP games
      if (gameRequest.game_type !== 'bot') {
        await notifyGameWin(gameId, winnerId, loserId, 'win');
      }

      const finalGameState = await GameRequest.getById(gameId);
      res.json(finalGameState);
    } else if (gameOverCondition?.draw) {
      await pool.query('UPDATE GameRequests SET status = $1 WHERE id = $2', ['draw', gameId]);

      await updateUserStats(gameRequest.creator_id, gameRequest.joiner_id, true);
      socket.getIo().emit('gameDraw', { gameId: parseInt(gameId) });

      // Send notification to both players in PvP games about the draw
      if (gameRequest.game_type !== 'bot') {
        await notifyGameDraw(gameId, gameRequest.creator_id, gameRequest.joiner_id);
      }

      const finalGameState = await GameRequest.getById(gameId);
      res.json(finalGameState);

    } else {

      // Send notification to the next active player in PvP games that it's their turn
      // Only send if user is NOT currently viewing the game board (prevents notification spam)
      if (gameRequest.game_type !== 'bot' && gameRequest.joiner_id) {
        try {
          // Determine the ID of the player whose turn it is (the active player, which is updatedBoardState.active_player)
          // Notification is sent to the *next* active player (the opponent of the one who just moved).
          const activePlayerId = updatedBoardState.active_player === 1 ? gameRequest.creator_id : gameRequest.joiner_id;

          // Check if user is currently viewing the game - don't spam notifications
          if (!(socket.isUserViewingGame && socket.isUserViewingGame(activePlayerId, gameId))) {
            const notificationMessage = `It's your turn!|game_id:${gameId}`;
            const notification = await Notification.create(activePlayerId, 'your_turn', notificationMessage);

            // Emit real-time notification to the active player
            socket.getIo().to(`user_${activePlayerId}`).emit('notification', notification);
          }
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
    if (!['public', 'bot'].includes(gameType)) {
      return res.status(400).json({ error: 'Invalid game type' });
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
    }

    const initialBoard = Array(boardSize).fill().map(() => Array(boardSize).fill(null));
    let player1Cones = variant.player1_cones;
    let player2Cones = variant.player2_cones;


    // Get difficulty (user override or admin default)
    let difficulty = botDifficulty;
    if (!difficulty) {
      const difficultyKey = `bot_difficulty_variant_${variantId}`;
      difficulty = await getSetting(difficultyKey, 'hard');
    }

    // Handle custom cones for Conquer Custom variant (ID 5)
    const { customCones } = req.body;
    if (parseInt(variantId) === 5 && customCones) {
      player1Cones = [
        customCones.small || 0,
        customCones.medium || 0,
        customCones.large || 0
      ];
      player2Cones = [...player1Cones]; // Bot gets same inventory
    }

    const randomValue = Math.random();
    const startingPlayer = randomValue < 0.5 ? 1 : 2;

    const gameRequest = await pool.query(
      'INSERT INTO GameRequests (creator_id, game_type, variant_id, status, board, active_player, player1_cones, player2_cones, joiner_id, bot_difficulty) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [creatorId, 'bot', variantId, 'joined', JSON.stringify(initialBoard), startingPlayer, JSON.stringify(player1Cones), JSON.stringify(player2Cones), null, difficulty]
    );

    const createdGame = gameRequest.rows[0];

    // If bot starts (active_player === 2), trigger bot move immediately
    // The frontend handles animation timing by freezing the board during randomization
    if (createdGame.active_player === 2) {

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

    if ((existingRequests.length + existingJoinedGames.length) >= maxActiveGames) {
      return res.status(400).json({ error: `You have reached the maximum limit of ${maxActiveGames} active games.` });
    }

    // Randomize starting player (1 or 2)
    const startingPlayer = Math.random() < 0.5 ? 1 : 2;

    const gameRequest = await GameRequest.join(requestId, joinerId, startingPlayer);

    // Emit event when the player joins
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

    // Prevent surrender if the game is already finished
    if (gameRequest.status !== 'joined') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    // For PvP games, ensure there is a joiner
    if (gameRequest.game_type !== 'bot' && !gameRequest.joiner_id) {
      return res.status(400).json({ error: 'Game has no opponent' });
    }

    // Determine the winner
    // If it's a bot game, joiner_id is null.
    // If creator surrenders against bot, winner should be 'bot' (or just handle stats differently).
    // Surrendering against a bot counts as a loss.
    let winner = null;
    let loser = surrenderingPlayer;

    if (gameRequest.game_type === 'bot') {
      // For bot games, the "winner" isn't a user ID. It's the bot.
      // We can represent bot as a specific ID or null.
      // The DB likely expects an integer for winner if it's a FK to Users.
      // If winner column is nullable, we can leave it null.
      // If we need to record a loss, we just update the loser's stats.
      winner = null;
    } else {
      winner = surrenderingPlayer === gameRequest.creator_id ? gameRequest.joiner_id : gameRequest.creator_id;
    }


    // Transaction for game status and user stats
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update the game status AND set winner
      await client.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', winner, gameId]);

      // Update user stats with transaction client
      await updateUserStats(winner, loser, false, client);

      await client.query('COMMIT');
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError; // Re-throw to be caught by outer catch
    } finally {
      client.release();
    }

    // Emit surrender event to specific users instead of globally
    // We emit after commit to ensure DB integrity first. If emit fails, UI might be stale but data is safe.
    if (gameRequest.creator_id) socket.getIo().to(`user_${gameRequest.creator_id}`).emit('gameSurrendered', { gameId: parseInt(gameId), winner });
    if (gameRequest.joiner_id) socket.getIo().to(`user_${gameRequest.joiner_id}`).emit('gameSurrendered', { gameId: parseInt(gameId), winner });

    // Send notification to both winner and loser about the surrender
    if (gameRequest.game_type !== 'bot') {
      await notifyGameWin(gameId, winner, loser, 'surrender');
    }

    res.json({ message: 'Game surrendered', winner });
  } catch (err) {
    console.error('Error in surrenderGame:', err);
    res.status(500).json({ error: err.message });
  }
};

// Function to update user statistics
const updateUserStats = async (winnerId, loserId, isDraw = false, client = null) => {
  const db = client || pool;
  try {
    // Explicitly cast the IDs to integers
    const winnerIdInt = parseInt(winnerId, 10);
    const loserIdInt = parseInt(loserId, 10);

    if (isDraw) {
      await db.query(
        'UPDATE Users SET draws = draws + 1 WHERE user_id = CAST($1 AS INTEGER) OR user_id = CAST($2 AS INTEGER)',
        [winnerIdInt, loserIdInt]
      );
    } else {
      if (!isNaN(winnerIdInt)) {
        await db.query(
          'UPDATE Users SET wins = wins + 1 WHERE user_id = CAST($1 AS INTEGER)',
          [winnerIdInt]
        );
      }

      if (!isNaN(loserIdInt)) {
        await db.query(
          'UPDATE Users SET losses = losses + 1 WHERE user_id = CAST($1 AS INTEGER)',
          [loserIdInt]
        );
      }
    }
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};

// Internal function to reset a game (called by Admin Dashboard)
exports.resetGame = async (req, res) => {
  try {
    const { gameId } = req.params;

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
exports.claimTimeout = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.body; // Expecting userId of the person claiming the timeout (should be req.user.user_id)

    // Security check: Ensure authenticated user matches the claimed user
    if (!req.user || req.user.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const game = await GameRequest.getById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'joined') {
      return res.status(400).json({ error: 'Game is not active' });
    }

    // Determine whose turn it is
    const activePlayerId = game.active_player === 1 ? game.creator_id : game.joiner_id;
    const opponentId = game.active_player === 1 ? game.joiner_id : game.creator_id;

    // The person claiming timeout must be the OPPONENT of the active player
    // (i.e., it's NOT their turn, they are waiting)
    if (userId !== opponentId) {
      // Allow the active player to claim usage if they want to concede? No.
      // Only the waiting player can claim "Action required by opponent, time up".
      return res.status(400).json({ error: 'It is not your turn to claim timeout' });
    }

    // Check time elapsed
    const lastMoveTime = new Date(game.last_move_at || game.updated_at).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - lastMoveTime) / 1000;
    const timeoutSeconds = game.move_timeout_seconds || 300;

    // Add a small grace period (e.g., 2 seconds) to account for network latency
    if (elapsedSeconds < timeoutSeconds - 2) {
      return res.status(400).json({ error: 'Timeout has not been reached yet' });
    }

    // Timeout CONFIRMED

    // Winner is the one who claimed it (the waiting player)
    const winnerId = userId;
    const loserId = activePlayerId;
    const winnerField = game.active_player === 1 ? 2 : 1; // If P1 was active, P2 wins (2). If P2 active, P1 wins (1).

    // Update Game
    await pool.query('UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3', ['won', winnerField, gameId]);
    await updateUserStats(winnerId, loserId);

    // Notify
    socket.getIo().emit('gameWon', { gameId: parseInt(gameId, 10), winner: winnerId }); // Sending userId as winner for PvP consistency

    // Send notifications
    await notifyGameWin(gameId, winnerId, loserId, 'timeout');

    res.json({ message: 'Timeout claimed successfully', winner: winnerId });

  } catch (err) {
    console.error('Error claiming timeout:', err);
    res.status(500).json({ error: err.message });
  }
};
