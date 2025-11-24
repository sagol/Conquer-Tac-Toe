const checkGameOverCondition = (board, player1Cones, player2Cones) => {
    const checkRowsAndColumns = () => {
        for (let i = 0; i < 3; i++) {
            // Check rows
            if (
                board[i][0] && board[i][1] && board[i][2] && // Ensure all cells in the row are occupied
                board[i][0].player === board[i][1].player &&
                board[i][1].player === board[i][2].player // All cells in the row belong to the same player
            ) {
                return board[i][0].player;
            }
            // Check columns
            if (
                board[0][i] && board[1][i] && board[2][i] && // Ensure all cells in the column are occupied
                board[0][i].player === board[1][i].player &&
                board[1][i].player === board[2][i].player // All cells in the column belong to the same player
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
            board[0][0] && board[1][1] && board[2][2] && // Ensure all cells in the diagonal are occupied
            board[0][0].player === board[1][1].player &&
            board[1][1].player === board[2][2].player // All cells in the diagonal belong to the same player
        ) {
            console.log('Diag 1 Winner:', board[0][0].player);
            return board[0][0].player;
        }
        if (
            board[0][2] && board[1][1] && board[2][0] && // Ensure all cells in the diagonal are occupied
            board[0][2].player === board[1][1].player &&
            board[1][1].player === board[2][0].player // All cells in the diagonal belong to the same player
        ) {
            return board[0][2].player;
        }
        return null;
    };

    const winner = checkRowsAndColumns() || checkDiagonals();
    if (winner) {
        return { winner };
    }

    // Check if any player can still make a move
    const hasValidMoves = (cones, board) => {
        for (let coneSize = 0; coneSize < 3; coneSize++) {
            if (cones[coneSize] > 0) { // Check if the player has cones of this size
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 3; col++) {
                        const cell = board[row][col];
                        if (!cell || coneSize > cell.size) {
                            // If there's an empty space or the player can place a cone over a smaller one
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
