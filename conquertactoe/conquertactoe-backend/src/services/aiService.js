const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://conquertactoe_autoplayer:8000';

/**
 * Request a move from the AI Service
 * @param {string} gameId - Game ID
 * @param {Array} board - NxN board state
 * @param {Array} playerCones - Player cone counts [small, medium, large]
 * @param {Array} botCones - Bot cone counts [small, medium, large]
 * @param {string} difficulty - Difficulty level ('easy', 'medium', 'hard')
 * @param {number} variantId - Game variant ID (1=Classic, 2=Gomoku, 3-5=Conquer)
 * @param {number} boardSize - Board size (3 for classic/conquer, 15 for gomoku, etc.)
 * @returns {Promise<{row: number, col: number, cone_size: number}>}
 */
async function getBotMove(gameId, board, playerCones, botCones, difficulty = 'medium', variantId = 3, boardSize = 3) {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/move`, {
            game_id: String(gameId), // Convert to string for autoplayer
            board,
            player_cones: playerCones,
            bot_cones: botCones,
            difficulty,
            variant_id: variantId,
            board_size: boardSize
        });
        return response.data;
    } catch (error) {
        console.error('Error calling AI Service:', error.message);
        throw new Error('AI Service unavailable');
    }
}

module.exports = { getBotMove };
