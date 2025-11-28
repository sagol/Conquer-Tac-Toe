const GameVariant = require('../models/GameVariant');

/**
 * Abstract Rules Engine for Game Variants
 * Handles game logic for all variant types based on their configuration
 */
class GameRules {
    constructor(variant) {
        this.variant = variant;
        this.rules = variant.rules;
        this.boardSize = variant.board_size;
        this.winLength = this.rules.requireLineLength || 3;
    }

    /**
     * Check if a move is valid based on variant rules
     * @param {number} row - Row index
     * @param {number} col - Column index
     * @param {number} coneSize - Size of cone being placed
     * @param {Array} board - Current board state
     * @param {Array} playerCones - Player's remaining cones
     * @param {number} playerNumber - The player making the move (1 or 2)
     * @returns {boolean} Whether the move is valid
     */
    isValidMove(row, col, coneSize, board, playerCones, playerNumber) {
        console.log('[Validation] isValidMove called:', {
            row, col, coneSize, playerNumber,
            boardSize: this.boardSize,
            actualBoardSize: board ? board.length : 'null',
            playerCones,
            cellValue: board[row]?.[col],
            rulesAllowOverwrite: this.rules.allowOverwrite
        });

        // CRITICAL: Use actual board dimensions, not variant default
        // (User can select different board sizes for Gomoku)
        const actualBoardSize = board ? board.length : this.boardSize;

        // Out of bounds check
        if (row < 0 || row >= actualBoardSize || col < 0 || col >= actualBoardSize) {
            console.log('[Validation] REJECTED: Out of bounds');
            return false;
        }

        // Check if player has this cone size available
        if (!playerCones || playerCones[coneSize] === undefined || playerCones[coneSize] <= 0) {
            console.log('[Validation] REJECTED: No cones available', {
                coneSize,
                available: playerCones?.[coneSize]
            });
            return false;
        }

        const cell = board[row][col];

        // Empty cell - always valid
        if (!cell) {
            console.log('[Validation] ACCEPTED: Empty cell');
            return true;
        }

        // Not allowed to overwrite
        if (!this.rules.allowOverwrite) {
            console.log('[Validation] REJECTED: Overwrite not allowed by variant');
            return false;
        }

        // Check overwrite rules
        if (this.rules.overwriteRules === 'larger_cone_only') {
            const result = coneSize > cell.size;
            console.log('[Validation]', result ? 'ACCEPTED' : 'REJECTED', ': larger_cone_only rule, coneSize:', coneSize, 'cellSize:', cell.size);
            return result;
        } else if (this.rules.overwriteRules === 'larger_or_same_size') {
            const result = coneSize >= cell.size;
            console.log('[Validation]', result ? 'ACCEPTED' : 'REJECTED', ': larger_or_same_size rule, coneSize:', coneSize, 'cellSize:', cell.size);
            return result;
        }

        console.log('[Validation] REJECTED: No matching rule');
        return false;
    }

    /**
     * Check win condition for the current board state
     * @param {Array} board - Current board state
     * @returns {number|null} Winner player number or null
     */
    checkWinCondition(board) {
        // Check rows
        if (this.rules.winConditions.includes('three_in_row') ||
            this.rules.winConditions.includes('five_in_row')) {
            const rowWinner = this._checkRows(board);
            if (rowWinner) return rowWinner;
        }

        // Check columns
        if (this.rules.winConditions.includes('three_in_column') ||
            this.rules.winConditions.includes('five_in_column')) {
            const colWinner = this._checkColumns(board);
            if (colWinner) return colWinner;
        }

        // Check diagonals
        if (this.rules.winConditions.includes('three_in_diagonal') ||
            this.rules.winConditions.includes('five_in_diagonal')) {
            const diagWinner = this._checkDiagonals(board);
            if (diagWinner) return diagWinner;
        }

        return null;
    }

    /**
     * Check all rows for a winner
     * @private
     */
    _checkRows(board) {
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col <= this.boardSize - this.winLength; col++) {
                const winner = this._checkLine(board, row, col, 0, 1);
                if (winner) return winner;
            }
        }
        return null;
    }

    /**
     * Check all columns for a winner
     * @private
     */
    _checkColumns(board) {
        for (let col = 0; col < this.boardSize; col++) {
            for (let row = 0; row <= this.boardSize - this.winLength; row++) {
                const winner = this._checkLine(board, row, col, 1, 0);
                if (winner) return winner;
            }
        }
        return null;
    }

    /**
     * Check all diagonals for a winner
     * @private
     */
    _checkDiagonals(board) {
        // Top-left to bottom-right diagonals
        for (let row = 0; row <= this.boardSize - this.winLength; row++) {
            for (let col = 0; col <= this.boardSize - this.winLength; col++) {
                const winner = this._checkLine(board, row, col, 1, 1);
                if (winner) return winner;
            }
        }

        // Top-right to bottom-left diagonals
        for (let row = 0; row <= this.boardSize - this.winLength; row++) {
            for (let col = this.winLength - 1; col < this.boardSize; col++) {
                const winner = this._checkLine(board, row, col, 1, -1);
                if (winner) return winner;
            }
        }

        return null;
    }

    /**
     * Check a specific line for a winner
     * @private
     * @param {Array} board - Board state
     * @param {number} startRow - Starting row
     * @param {number} startCol - Starting column
     * @param {number} rowDelta - Row increment
     * @param {number} colDelta - Column increment
     * @returns {number|null} Winner or null
     */
    _checkLine(board, startRow, startCol, rowDelta, colDelta) {
        // CRITICAL: Bounds check for the first cell
        if (startRow < 0 || startRow >= board.length || startCol < 0 || !board[startRow] || startCol >= board[startRow].length) {
            return null;
        }

        const firstCell = board[startRow][startCol];
        if (!firstCell) return null;

        const player = firstCell.player;

        for (let i = 1; i < this.winLength; i++) {
            const row = startRow + i * rowDelta;
            const col = startCol + i * colDelta;

            // CRITICAL: Bounds check before accessing board
            if (row < 0 || row >= board.length || col < 0 || !board[row] || col >= board[row].length) {
                return null; // Line goes out of bounds, cannot be a win
            }

            const cell = board[row][col];

            if (!cell || cell.player !== player) {
                return null;
            }
        }

        return player;
    }

    /**
     * Check if a player has any valid moves remaining
     * @param {Array} playerCones - Player's remaining cones
     * @param {Array} board - Current board state
     * @param {number} playerNumber - The player number (1 or 2)
     * @returns {boolean} Whether player has valid moves
     */
    hasValidMoves(playerCones, board, playerNumber) {
        for (let coneSize = 0; coneSize < playerCones.length; coneSize++) {
            if (playerCones[coneSize] > 0) {
                for (let row = 0; row < this.boardSize; row++) {
                    for (let col = 0; col < this.boardSize; col++) {
                        if (this.isValidMove(row, col, coneSize, board, playerCones, playerNumber)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}

/**
 * Factory function to create rules engine for a game
 * @param {number} variantId - The variant ID
 * @returns {Promise<GameRules>} Rules engine instance
 */
async function createRulesEngine(variantId) {
    const variant = await GameVariant.getById(variantId);
    if (!variant) {
        throw new Error(`Variant ${variantId} not found`);
    }
    return new GameRules(variant);
}

module.exports = { GameRules, createRulesEngine };
