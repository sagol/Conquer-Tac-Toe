const { createRulesEngine } = require('./gameRules');

/**
 * Check game over condition using variant-specific rules
 * @param {Array} board - Current board state
 * @param {Array} player1Cones - Player 1's remaining cones
 * @param {Array} player2Cones - Player 2's remaining cones
 * @param {number} variantId - The game variant ID
 * @returns {Promise<Object|null>} Game over result or null
 */
const checkGameOverCondition = async (board, player1Cones, player2Cones, variantId = 3) => {
    try {
        // Create rules engine for this variant
        const rulesEngine = await createRulesEngine(variantId);

        // Check win condition
        const winner = rulesEngine.checkWinCondition(board);
        if (winner) {
            return { winner };
        }

        // Check for draw (no valid moves for both players)
        const player1CanMove = rulesEngine.hasValidMoves(player1Cones, board);
        const player2CanMove = rulesEngine.hasValidMoves(player2Cones, board);

        if (!player1CanMove && !player2CanMove) {
            return { draw: true };
        }

        return null;
    } catch (error) {
        console.error('Error checking game over condition:', error);
        return null;
    }
};

module.exports = { checkGameOverCondition };
