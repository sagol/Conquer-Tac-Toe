const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://conquertactoe_autoplayer:8000';

/**
 * Request a move from the AI Service
 * @param {string} gameId - Game ID
 * @param {Array} board - 3x3 board state
 * @param {Array} playerCones - Player cone counts [small, medium, large]
 * @param {Array} botCones - Bot cone counts [small, medium, large]
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
 * @returns {Promise<{row: number, col: number, cone_size: number}>}
 */
async function getBotMove(gameId, board, playerCones, botCones, difficulty = 'medium') {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/move`, {
            game_id: gameId,
            board,
            player_cones: playerCones,
            bot_cones: botCones,
            difficulty
        });
        return response.data;
    } catch (error) {
        console.error('Error calling AI Service:', error.message);
        throw new Error('AI Service unavailable');
    }
}

module.exports = { getBotMove };
