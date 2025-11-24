import random

class HeuristicBot:
    def __init__(self):
        pass

    def get_move(self, board, player_cones, bot_cones, difficulty="medium"):
        """
        Determines the best move based on the current board state and difficulty.
        """
        # 1. Check for winning move
        winning_move = self.find_winning_move(board, bot_cones)
        if winning_move:
            return winning_move

        # 2. Block opponent's winning move
        blocking_move = self.find_blocking_move(board, player_cones)
        if blocking_move:
            return blocking_move

        # 3. Take center if available (and we have a large cone)
        if board[1][1] is None and bot_cones[2] > 0:
            return {"row": 1, "col": 1, "cone_size": 2}

        # 4. Random valid move
        return self.get_random_move(board, bot_cones)

    def find_winning_move(self, board, cones):
        # Simplified check: iterate all possible moves and see if they win
        # In a real implementation, this would be more optimized
        for size_idx, count in enumerate(cones):
            if count > 0:
                for r in range(3):
                    for c in range(3):
                        if self.is_valid_move(board, r, c, size_idx):
                            # Simulate move
                            original = board[r][c]
                            board[r][c] = {"player": 2, "size": size_idx} # Assume bot is player 2
                            if self.check_win(board, 2):
                                board[r][c] = original # Backtrack
                                return {"row": r, "col": c, "cone_size": size_idx}
                            board[r][c] = original # Backtrack
        return None

    def find_blocking_move(self, board, opponent_cones):
        # Check if opponent has a winning move and take that spot
        for size_idx, count in enumerate(opponent_cones):
            if count > 0:
                for r in range(3):
                    for c in range(3):
                        if self.is_valid_move(board, r, c, size_idx):
                            original = board[r][c]
                            board[r][c] = {"player": 1, "size": size_idx} # Assume opponent is player 1
                            if self.check_win(board, 1):
                                board[r][c] = original
                                # Found a spot where opponent wins. Can we block it?
                                # We need to place a cone >= opponent's cone size (if empty) or > (if occupied)
                                # For simplicity, just try to place our largest available cone there
                                best_block = self.find_best_cone_for_spot(board, r, c)
                                if best_block:
                                     return {"row": r, "col": c, "cone_size": best_block}
                            board[r][c] = original
        return None

    def get_random_move(self, board, cones):
        valid_moves = []
        for size_idx, count in enumerate(cones):
            if count > 0:
                for r in range(3):
                    for c in range(3):
                        if self.is_valid_move(board, r, c, size_idx):
                            valid_moves.append({"row": r, "col": c, "cone_size": size_idx})
        
        if not valid_moves:
            return None
        return random.choice(valid_moves)

    def is_valid_move(self, board, r, c, size):
        cell = board[r][c]
        if cell is None:
            return True
        return size > cell['size']

    def find_best_cone_for_spot(self, board, r, c):
        # TODO: Implement logic to find the smallest cone that can block
        # For now, return largest available
        return 2 # Placeholder

    def check_win(self, board, player):
        # Check rows, cols, diagonals
        for i in range(3):
            if all(board[i][j] and board[i][j]['player'] == player for j in range(3)): return True
            if all(board[j][i] and board[j][i]['player'] == player for j in range(3)): return True
        if all(board[i][i] and board[i][i]['player'] == player for i in range(3)): return True
        if all(board[i][2-i] and board[i][2-i]['player'] == player for i in range(3)): return True
        return False
