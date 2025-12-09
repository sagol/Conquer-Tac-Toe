/**
 * Move Timeout Checker Service
 * 
 * Runs periodically to check for games where the active player's move has timed out.
 * When a timeout is detected, the game is automatically forfeited.
 */

const pool = require('../config/db');
const socket = require('../socket');
const Notification = require('../models/Notification');

// Default timeout in seconds (5 minutes)
const DEFAULT_TIMEOUT_SECONDS = 300;

// Check interval in milliseconds (every 30 seconds)
const CHECK_INTERVAL_MS = 30000;

let intervalId = null;

/**
 * Check for timed out games and forfeit them
 */
async function checkTimeouts() {
    try {
        // Find all active PvP games where the move has timed out
        const result = await pool.query(`
            SELECT id, creator_id, joiner_id, active_player, game_type, last_move_at, 
                   COALESCE(move_timeout_seconds, $1) as timeout_seconds
            FROM GameRequests 
            WHERE status = 'joined' 
              AND game_type != 'bot'
              AND last_move_at IS NOT NULL
              AND NOW() > last_move_at + (COALESCE(move_timeout_seconds, $1) || ' seconds')::INTERVAL
        `, [DEFAULT_TIMEOUT_SECONDS]);

        for (const game of result.rows) {
            await handleTimeout(game);
        }

        if (result.rows.length > 0) {
            console.log(`[TimeoutChecker] Processed ${result.rows.length} timed out games`);
        }
    } catch (err) {
        console.error('[TimeoutChecker] Error checking timeouts:', err);
    }
}

/**
 * Handle a single game timeout
 */
async function handleTimeout(game) {
    try {
        const { id: gameId, creator_id, joiner_id, active_player } = game;

        // The player who timed out is the active player
        const loser = active_player === 1 ? creator_id : joiner_id;
        const winner = active_player === 1 ? joiner_id : creator_id;

        console.log(`[TimeoutChecker] Game ${gameId}: Player ${loser} timed out. Winner: ${winner}`);

        // Update game status
        await pool.query(
            'UPDATE GameRequests SET status = $1, winner = $2 WHERE id = $3',
            ['won', winner, gameId]
        );

        // Update user stats
        const winnerIdInt = parseInt(winner, 10);
        const loserIdInt = parseInt(loser, 10);

        if (!isNaN(winnerIdInt)) {
            await pool.query('UPDATE Users SET wins = wins + 1 WHERE user_id = $1', [winnerIdInt]);
        }
        if (!isNaN(loserIdInt)) {
            await pool.query('UPDATE Users SET losses = losses + 1 WHERE user_id = $1', [loserIdInt]);
        }

        // Emit game timeout event via socket
        socket.getIo().emit('gameTimeout', {
            gameId: parseInt(gameId),
            winner,
            loser,
            reason: 'timeout'
        });

        // Send notifications
        try {
            // Notify the loser
            const loserNotification = await Notification.create(
                loser,
                'game_timeout',
                `You ran out of time and lost the game!|game_id:${gameId}`
            );
            socket.getIo().to(`user_${loser}`).emit('notification', loserNotification);

            // Notify the winner
            const winnerNotification = await Notification.create(
                winner,
                'game_won',
                `Your opponent ran out of time! You won!|game_id:${gameId}`
            );
            socket.getIo().to(`user_${winner}`).emit('notification', winnerNotification);
        } catch (notifErr) {
            console.error('[TimeoutChecker] Failed to send timeout notifications:', notifErr);
        }

    } catch (err) {
        console.error(`[TimeoutChecker] Error handling timeout for game ${game.id}:`, err);
    }
}

/**
 * Start the timeout checker
 */
function start() {
    if (intervalId) {
        console.log('[TimeoutChecker] Already running');
        return;
    }

    console.log(`[TimeoutChecker] Starting with ${CHECK_INTERVAL_MS}ms interval`);
    intervalId = setInterval(checkTimeouts, CHECK_INTERVAL_MS);

    // Run immediately on start
    checkTimeouts();
}

/**
 * Stop the timeout checker
 */
function stop() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('[TimeoutChecker] Stopped');
    }
}

module.exports = { start, stop, checkTimeouts };
