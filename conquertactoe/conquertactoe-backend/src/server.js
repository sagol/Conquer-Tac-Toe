const { app, server } = require('./app');
const pool = require('./config/db');
const timeoutChecker = require('./services/timeoutChecker');

const PORT = process.env.PORT || 3000;

const srv = server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful Custom Shutdown
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  // Stop background services
  timeoutChecker.stop();

  try {
    // Stop accepting new connections
    srv.close(async () => {
      console.log('HTTP/Socket server closed.');

      try {
        // Close database pool
        await pool.end();
        console.log('Database pool closed.');
        process.exit(0);
      } catch (err) {
        console.error('Error closing database pool:', err);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error('Error closing server:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
