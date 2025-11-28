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
        // Fallback to legacy logic if variant not found
        return checkGameOverConditionLegacy(board, player1Cones, player2Cones);
    }
};

/**
 * Legacy game over check (backward compatibility)
 * @private
 */
const checkGameOverConditionLegacy = (board, player1Cones, player2Cones) => {
    const checkRowsAndColumns = () => {
        for (let i = 0; i < 3; i++) {
            // Check rows
            if (
                board[i][0] && board[i][1] && board[i][2] &&
                board[i][0].player === board[i][1].player &&
                board[i][1].player === board[i][2].player
            ) {
                return board[i][0].player;
            }
            // Check columns
            if (
                board[0][i] && board[1][i] && board[2][i] &&
                board[0][i].player === board[1][i].player &&
                board[1][i].player === board[2][i].player
            ) {
                return board[0][i].player;
            }
        }
        return null;
    };

    const checkDiagonals = () => {
        console.log('Checking diagonals...');
        console.log('Diag 1:', board[0][0], board[1][1], board[2][2]);
        if (
            board[0][0] && board[1][1] && board[2][2] &&
            board[0][0].player === board[1][1].player &&
            board[1][1].player === board[2][2].player
        ) {
            console.log('Diag 1 Winner:', board[0][0].player);
            return board[0][0].player;
        }
        if (
            board[0][2] && board[1][1] && board[2][0] &&
            board[0][2].player === board[1][1].player &&
            board[1][1].player === board[2][0].player
        ) {
            return board[0][2].player;
        }
        return null;
    };

    const winner = checkRowsAndColumns() || checkDiagonals();
    if (winner) {
        return { winner };
    }

    const hasValidMoves = (cones, board) => {
        for (let coneSize = 0; coneSize < 3; coneSize++) {
            if (cones[coneSize] > 0) {
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 3; col++) {
                        const cell = board[row][col];
                        if (!cell || coneSize > cell.size) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    };

    const player1CanMove = hasValidMoves(player1Cones, board);
    const player2CanMove = hasValidMoves(player2Cones, board);
    const isDraw = !player1CanMove && !player2CanMove;

    if (isDraw) {
        return { draw: true };
    }

    return null;
};

module.exports = { checkGameOverCondition };
