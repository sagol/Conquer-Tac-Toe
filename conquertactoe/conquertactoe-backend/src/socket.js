const { Server } = require('socket.io');
const { isValidUserId } = require('./utils/validation');

let io;

// Rate limiting constants for joinUserRoom event
const LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_ATTEMPTS = 5; // Max attempts per window

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

  // Safe: sessionMiddleware is checked before use (if statement)
  // If sessionMiddleware is null/undefined, this block is skipped entirely
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
      // Rate limiting: allow max 5 attempts per minute per socket
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

          // Prevent duplicate joins
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

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
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

module.exports = { init, getIo };
