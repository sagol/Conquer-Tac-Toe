const { Server } = require('socket.io');

let io;

function init(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join user-specific room for private notifications
    socket.on('joinUserRoom', (userId) => {
      // Validate userId is a valid number
      if (userId && (typeof userId === 'number' || (typeof userId === 'string' && !isNaN(parseInt(userId))))) {
        const roomName = `user_${userId}`;
        socket.join(roomName);
        console.log(`Socket ${socket.id} joined room ${roomName}`);
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
