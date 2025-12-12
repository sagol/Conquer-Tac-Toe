const { Server } = require('socket.io');
const { isValidUserId } = require('./utils/validation');

let io;

// Rate limiting constants for joinUserRoom event
const LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_ATTEMPTS = 5; // Max attempts per window

// ============================================
// REMATCH SYSTEM - In-memory tracking
// ============================================
// Map: gameId -> { requesterId, opponentId, timestamp, accepted: Set<userId>, timeoutId }
const pendingRematches = new Map();
const REMATCH_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Clean up a pending rematch (clear timeout, remove from Map)
 */
function cleanupRematch(gameId) {
  const pending = pendingRematches.get(gameId);
  if (pending?.timeoutId) {
    clearTimeout(pending.timeoutId);
  }
  pendingRematches.delete(gameId);
}

/**
 * Get pending rematch for a game if the user is the opponent
 * Returns rematch data or null if no pending rematch for this user
 */
function getPendingRematch(gameId, userId) {
  const pending = pendingRematches.get(parseInt(gameId));
  if (!pending) return null;

  // Only return if this user is the opponent (not the requester)
  if (pending.opponentId !== userId) return null;

  // Calculate remaining time
  const elapsed = Date.now() - pending.timestamp;
  const remainingMs = Math.max(0, REMATCH_TIMEOUT_MS - elapsed);

  if (remainingMs <= 0) {
    // Rematch has timed out
    return null;
  }

  return {
    gameId: parseInt(gameId),
    requesterId: pending.requesterId,
    requesterName: pending.requesterName,
    timeoutMs: remainingMs
  };
}

/**
 * HTTP-callable function to accept a rematch (bypasses socket auth issues)
 * Returns { success, newGameId, error }
 */
async function acceptRematchHttp(gameId, accepterId) {
  const pending = pendingRematches.get(parseInt(gameId));
  if (!pending) {
    return { success: false, error: 'No pending rematch for this game' };
  }

  // Verify this user is the opponent
  if (pending.opponentId !== accepterId) {
    return { success: false, error: 'You are not the opponent for this rematch' };
  }

  console.log(`[Rematch HTTP] User ${accepterId} accepted rematch for game ${gameId}`);

  pending.accepted.add(accepterId);

  // Check if both players have now accepted
  if (pending.accepted.size >= 2) {
    console.log(`[Rematch HTTP] Both players accepted! Creating new game...`);

    const player1Id = pending.requesterId;
    const player2Id = pending.opponentId;

    const newGame = await createRematchGame(gameId, player1Id, player2Id);

    if (newGame) {
      const acceptedPayload = {
        newGameId: newGame.id,
        originalGameId: parseInt(gameId)
      };

      // Emit events to notify clients via socket
      if (io) {
        io.to(`user_${player1Id}`).emit('rematchAccepted', acceptedPayload);
        io.to(`user_${player2Id}`).emit('rematchAccepted', acceptedPayload);
        io.to(`game_${gameId}`).emit('rematchAccepted', acceptedPayload);
        io.emit('playerJoined', newGame);
      }

      cleanupRematch(parseInt(gameId));
      return { success: true, newGameId: newGame.id };
    } else {
      return { success: false, error: 'Failed to create rematch game' };
    }
  }

  // Only one player has accepted so far - wait for the other
  return { success: true, waiting: true };
}

/**
 * Create a new game for rematch (called when both players agree)
 * Returns the new game ID or null on error
 */
async function createRematchGame(originalGameId, player1Id, player2Id) {
  try {
    const pool = require('./config/db');

    // Get original game settings
    const originalGame = await pool.query(
      'SELECT variant_id, game_type FROM GameRequests WHERE id = $1',
      [originalGameId]
    );

    if (originalGame.rows.length === 0) {
      console.error(`[Rematch] Original game ${originalGameId} not found`);
      return null;
    }

    const { variant_id } = originalGame.rows[0];

    // Get variant configuration
    const GameVariant = require('./models/GameVariant');
    const variant = await GameVariant.getById(variant_id || 3);

    if (!variant) {
      console.error(`[Rematch] Variant ${variant_id} not found`);
      return null;
    }

    // Initialize board and cones
    const boardSize = variant.board_size;
    const initialBoard = Array(boardSize).fill().map(() => Array(boardSize).fill(null));
    const player1Cones = variant.player1_cones;
    const player2Cones = variant.player2_cones;

    // Randomize starting player
    const startingPlayer = Math.random() < 0.5 ? 1 : 2;
    console.log(`[Rematch] New game starting player: ${startingPlayer}`);

    // Create new game with both players already joined
    const newGame = await pool.query(
      `INSERT INTO GameRequests 
        (creator_id, joiner_id, game_type, variant_id, status, board, active_player, player1_cones, player2_cones)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [player1Id, player2Id, 'public', variant_id, 'joined',
        JSON.stringify(initialBoard), startingPlayer,
        JSON.stringify(player1Cones), JSON.stringify(player2Cones)]
    );

    console.log(`[Rematch] Created new game ${newGame.rows[0].id} from original ${originalGameId}`);
    return newGame.rows[0];
  } catch (err) {
    console.error('[Rematch] Error creating rematch game:', err);
    return null;
  }
}

function init(server, sessionMiddleware) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Convert express middleware to socket.io middleware
  const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);

  // Defensive programming: Check sessionMiddleware before use
  // In current app.js initialization, sessionMiddleware is always defined.
  // However, this check provides safety for:
  // - Future refactoring or different initialization patterns
  // - Unit testing scenarios where middleware might be mocked/skipped
  // - Deployment configurations that might disable sessions
  // The overhead is negligible and prevents potential runtime errors.
  if (sessionMiddleware) {
    io.use(wrap(sessionMiddleware));
    const passport = require('passport');
    io.use(wrap(passport.initialize()));
    io.use(wrap(passport.session()));
  }

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Log  authenticated user if present
    const user = socket.request.user;
    if (user) {
      console.log(`Socket ${socket.id} authenticated as user ${user.username} (${user.user_id})`);
    }



    // Join user-specific room for private notifications
    socket.on('joinUserRoom', (userId) => {
      // Rate limiting: allow max 5 attempts per minute per socket connection
      // SCOPE: Per-socket (not per-user) - intentional tradeoff for simplicity
      // - Pros: Simple implementation, automatic cleanup on disconnect, no shared state needed
      // - Cons: User can bypass by opening multiple socket connections
      // - Acceptable for this use case: joinUserRoom is non-destructive, and user authentication
      //   provides primary security. Rate limit prevents accidental spam, not determined attacks.
      // Rate limit state is attached to the ephemeral socket instance and is garbage collected on disconnect.

      // Initialize rate limit state if needed
      if (!socket.rateLimit) socket.rateLimit = { count: 0, firstAttempt: Date.now() };

      // Reset window if expired
      if (Date.now() - socket.rateLimit.firstAttempt > LIMIT_WINDOW_MS) {
        socket.rateLimit = { count: 0, firstAttempt: Date.now() };
      }

      socket.rateLimit.count++;

      if (socket.rateLimit.count > MAX_ATTEMPTS) {
        console.warn(`Rate limit exceeded for joinUserRoom from socket ${socket.id}`);
        // Silent return or error emission
        return;
      }

      // Validate userId
      if (isValidUserId(userId)) {
        const targetUserId = parseInt(userId, 10);
        const authenticatedUser = socket.request.user;

        // Security Check: Ensure the connected socket belongs to the user they are trying to join
        if (authenticatedUser && parseInt(authenticatedUser.user_id, 10) === targetUserId) {
          const roomName = `user_${targetUserId}`;

          // Prevent duplicate joins using Set.has() (socket.rooms is a Set in Socket.IO 4.x)
          // Note: .has() is the correct Set API method. Array.from().includes() would work
          // but is less efficient and unnecessary for Sets.
          if (socket.rooms.has(roomName)) {
            console.log(`Socket ${socket.id} already in room ${roomName}`);
            return;
          }

          socket.join(roomName);
          console.log(`Socket ${socket.id} joined room ${roomName} (Authorized)`);
        } else {
          console.warn(`Unauthorized joinUserRoom attempt. Socket User: ${authenticatedUser?.user_id || 'Unauthenticated'}, Target: ${targetUserId}`);
          socket.emit('error', { message: 'Unauthorized to join this notification room.' });
        }
      } else {
        console.warn(`Invalid userId for joinUserRoom: ${userId} (type: ${typeof userId})`);
      }
    });

    // ============================================
    // GAME ROOM EVENTS - Track when user is viewing a game
    // This is used to suppress in-game notifications when user is already on the board
    // ============================================

    /**
     * Join a game-specific room when viewing the game board.
     * Expected payload: { gameId }
     */
    socket.on('joinGameRoom', (gameId) => {
      if (!gameId) return;

      const roomName = `game_${gameId}`;
      if (socket.rooms.has(roomName)) {
        return; // Already in room
      }

      socket.join(roomName);
      console.log(`Socket ${socket.id} joined game room ${roomName}`);

      // Check if there's a pending rematch for this game
      // If the joining user is the opponent, send them the rematch request
      const pending = pendingRematches.get(parseInt(gameId));
      if (pending) {
        const userId = socket.request.user?.user_id;
        if (userId && userId === pending.opponentId) {
          console.log(`[Rematch] Syncing pending rematch for game ${gameId} to user ${userId}`);
          // Calculate remaining timeout
          const elapsed = Date.now() - pending.timestamp;
          const remainingMs = Math.max(0, REMATCH_TIMEOUT_MS - elapsed);

          if (remainingMs > 0) {
            socket.emit('rematchRequested', {
              gameId: parseInt(gameId),
              requesterId: pending.requesterId,
              requesterName: pending.requesterName,
              timeoutMs: remainingMs
            });
          }
        }
      }
    });

    /**
     * Leave a game-specific room when navigating away from game board.
     * Expected payload: { gameId }
     */
    socket.on('leaveGameRoom', (gameId) => {
      if (!gameId) return;

      const roomName = `game_${gameId}`;
      socket.leave(roomName);
      console.log(`Socket ${socket.id} left game room ${roomName}`);
    });

    // ============================================
    // REMATCH SOCKET EVENTS
    // ============================================

    /**
     * Player requests a rematch after game ends
     * Expected payload: { gameId, opponentId }
     */
    socket.on('requestRematch', async ({ gameId, opponentId }) => {
      const requesterId = socket.request.user?.user_id;
      if (!requesterId) {
        socket.emit('rematchError', { message: 'Not authenticated' });
        return;
      }

      console.log(`[Rematch] User ${requesterId} requesting rematch for game ${gameId}`);

      // Check if there's already a pending rematch for this game
      const existing = pendingRematches.get(gameId);

      if (existing) {
        // Check if opponent already requested (simultaneous Play Again)
        if (existing.accepted.has(opponentId)) {
          console.log(`[Rematch] Both players agreed! Creating new game...`);

          // Both agreed - create new game
          const newGame = await createRematchGame(gameId, requesterId, opponentId);

          if (newGame) {
            // Notify both players (user rooms and game room)
            const acceptedPayload = {
              newGameId: newGame.id,
              originalGameId: gameId
            };
            io.to(`user_${requesterId}`).emit('rematchAccepted', acceptedPayload);
            io.to(`user_${opponentId}`).emit('rematchAccepted', acceptedPayload);
            io.to(`game_${gameId}`).emit('rematchAccepted', acceptedPayload);

            // Also emit playerJoined for lobby updates
            io.emit('playerJoined', newGame);
          } else {
            io.to(`user_${requesterId}`).emit('rematchError', { message: 'Failed to create rematch game' });
            io.to(`user_${opponentId}`).emit('rematchError', { message: 'Failed to create rematch game' });
          }

          cleanupRematch(gameId);
          return;
        }

        // Requester already requested, ignore duplicate
        if (existing.requesterId === requesterId) {
          console.log(`[Rematch] Duplicate request from ${requesterId}, ignoring`);
          return;
        }
      }

      // Create new pending rematch
      const timeoutId = setTimeout(async () => {
        console.log(`[Rematch] Timeout for game ${gameId}`);

        // Notify both players of timeout (user rooms and game room)
        io.to(`user_${requesterId}`).emit('rematchTimeout', { gameId });
        io.to(`user_${opponentId}`).emit('rematchTimeout', { gameId });
        io.to(`game_${gameId}`).emit('rematchTimeout', { gameId });

        cleanupRematch(gameId);
      }, REMATCH_TIMEOUT_MS);

      pendingRematches.set(gameId, {
        requesterId,
        opponentId,
        requesterName: socket.request.user?.username || 'Opponent',
        timestamp: Date.now(),
        accepted: new Set([requesterId]), // Requester has implicitly accepted
        timeoutId
      });

      // Check if opponent is online (has active socket in their room)
      const opponentRoom = `user_${opponentId}`;
      const opponentSockets = io.sockets.adapter.rooms.get(opponentRoom);

      // ALWAYS emit to game room - opponent might be viewing the game board
      io.to(`game_${gameId}`).emit('rematchRequested', {
        gameId,
        requesterId,
        requesterName: socket.request.user?.username || 'Opponent',
        timeoutMs: REMATCH_TIMEOUT_MS
      });
      console.log(`[Rematch] Sent rematchRequested to game room game_${gameId}`);

      if (opponentSockets && opponentSockets.size > 0) {
        // Opponent is online - also send to user room
        io.to(opponentRoom).emit('rematchRequested', {
          gameId,
          requesterId,
          requesterName: socket.request.user?.username || 'Opponent',
          timeoutMs: REMATCH_TIMEOUT_MS
        });
        console.log(`[Rematch] Sent rematchRequested to online opponent ${opponentId} (user room)`);
      } else {
        // Opponent is offline - create notification for later
        console.log(`[Rematch] Opponent ${opponentId} is offline, creating notification`);
        try {
          const Notification = require('./models/Notification');
          const notificationMessage = `${socket.request.user?.username || 'A player'} wants a rematch!|game_id:${gameId}|rematch:true`;
          const notification = await Notification.create(opponentId, 'rematch_request', notificationMessage);

          // Also emit to user room in case they reconnect
          io.to(opponentRoom).emit('notification', notification);
        } catch (err) {
          console.error('[Rematch] Failed to create notification:', err);
        }
      }

      // Confirm to requester that request was sent
      socket.emit('rematchRequestSent', {
        gameId,
        opponentId,
        timeoutMs: REMATCH_TIMEOUT_MS
      });
    });

    /**
     * Player accepts a rematch request
     * Expected payload: { gameId }
     */
    socket.on('acceptRematch', async ({ gameId }) => {
      const accepterId = socket.request.user?.user_id;
      console.log(`[Rematch] acceptRematch received for game ${gameId}, socket ${socket.id}, user:`, socket.request.user?.user_id || 'UNAUTHENTICATED');

      if (!accepterId) {
        console.log(`[Rematch] Accept denied - socket ${socket.id} is not authenticated`);
        socket.emit('rematchError', { message: 'Not authenticated' });
        return;
      }

      const pending = pendingRematches.get(gameId);
      if (!pending) {
        socket.emit('rematchError', { message: 'No pending rematch for this game' });
        return;
      }

      console.log(`[Rematch] User ${accepterId} accepted rematch for game ${gameId}`);

      pending.accepted.add(accepterId);

      // Check if both players have now accepted
      if (pending.accepted.size >= 2) {
        console.log(`[Rematch] Both players accepted! Creating new game...`);

        // Determine player IDs (requester = player1, accepter = player2)
        const player1Id = pending.requesterId;
        const player2Id = pending.opponentId;

        const newGame = await createRematchGame(gameId, player1Id, player2Id);

        if (newGame) {
          const acceptedPayload = {
            newGameId: newGame.id,
            originalGameId: gameId
          };
          // Emit to both user rooms and game room
          io.to(`user_${player1Id}`).emit('rematchAccepted', acceptedPayload);
          io.to(`user_${player2Id}`).emit('rematchAccepted', acceptedPayload);
          io.to(`game_${gameId}`).emit('rematchAccepted', acceptedPayload);

          // Emit for lobby updates
          io.emit('playerJoined', newGame);
        } else {
          io.to(`user_${player1Id}`).emit('rematchError', { message: 'Failed to create rematch game' });
          io.to(`user_${player2Id}`).emit('rematchError', { message: 'Failed to create rematch game' });
        }

        cleanupRematch(gameId);
      }
    });

    /**
     * Player declines a rematch request
     * Expected payload: { gameId }
     */
    socket.on('declineRematch', ({ gameId }) => {
      const declinerId = socket.request.user?.user_id;
      if (!declinerId) return;

      const pending = pendingRematches.get(gameId);
      if (!pending) return;

      console.log(`[Rematch] User ${declinerId} declined rematch for game ${gameId}`);

      // Notify the requester (user room and game room)
      io.to(`user_${pending.requesterId}`).emit('rematchDeclined', {
        gameId,
        declinedBy: declinerId
      });
      io.to(`game_${gameId}`).emit('rematchDeclined', {
        gameId,
        declinedBy: declinerId
      });

      cleanupRematch(gameId);
    });

    /**
     * Player cancels their own rematch request
     * Expected payload: { gameId }
     */
    socket.on('cancelRematch', ({ gameId }) => {
      const cancellerId = socket.request.user?.user_id;
      if (!cancellerId) return;

      const pending = pendingRematches.get(gameId);
      if (!pending || pending.requesterId !== cancellerId) return;

      console.log(`[Rematch] User ${cancellerId} cancelled rematch request for game ${gameId}`);

      // Notify opponent that request was cancelled (user room and game room)
      io.to(`user_${pending.opponentId}`).emit('rematchCancelled', { gameId });
      io.to(`game_${gameId}`).emit('rematchCancelled', { gameId });

      cleanupRematch(gameId);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Note: Pending rematches are NOT cleaned up on disconnect.
      // This allows the opponent to still accept via notification when they come online.
      // Timeout will handle cleanup if no response.
    });
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

/**
 * Check if a user is currently viewing a specific game board.
 * Used to suppress in-game notifications when user is already on the board.
 * 
 * @param {number} userId - The user ID to check
 * @param {number} gameId - The game ID to check
 * @returns {boolean} - True if user has a socket in the game room
 */
function isUserViewingGame(userId, gameId) {
  if (!io) {
    console.log('[isUserViewingGame] io not initialized, returning false');
    return false;
  }

  const gameRoom = `game_${gameId}`;

  // Get all socket IDs in the game room
  const gameRoomSockets = io.sockets.adapter.rooms.get(gameRoom);
  console.log(`[isUserViewingGame] Game room ${gameRoom}: ${gameRoomSockets ? gameRoomSockets.size : 0} sockets`);

  if (!gameRoomSockets || gameRoomSockets.size === 0) {
    console.log(`[isUserViewingGame] User ${userId} NOT in game ${gameId} (no sockets in game room)`);
    return false;
  }

  // Check if any socket in the game room belongs to this user
  for (const socketId of gameRoomSockets) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.request?.user?.user_id === userId) {
      console.log(`[isUserViewingGame] User ${userId} IS viewing game ${gameId} (socket ${socketId})`);
      return true;
    }
  }

  console.log(`[isUserViewingGame] User ${userId} NOT in game ${gameId} (no matching user socket)`);
  return false;
}

module.exports = { init, getIo, isUserViewingGame, getPendingRematch, acceptRematchHttp };

