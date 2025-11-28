import random
from typing import Dict, Any, Optional
from core.bot_interface import IBot

class HeuristicBot(IBot):
    """Existing bot for Conquer-Tac-Toe variants"""
    
    @property
    def name(self) -> str:
        return "Conquer Heuristic Bot"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Determines the best move based on the current board state and difficulty.
        """
        board = game_state.get("board")
        bot_cones = game_state.get("bot_cones")
        
        if not board or not bot_cones:
            return None

        # 1. Check for winning move
        winning_move = self.find_winning_move(board, bot_cones)
        if winning_move:
            return winning_move

        # 2. Block opponent's winning move
        blocking_move = self.find_blocking_move(board, bot_cones)
        if blocking_move:
            return blocking_move

        # 3. Take center if available (and we have a large cone)
        if board[1][1] is None and len(bot_cones) > 2 and bot_cones[2] > 0:
            return {"row": 1, "col": 1, "cone_size": 2}

        # 4. Random valid move
        return self.get_random_move(board, bot_cones)

    def find_winning_move(self, board, cones):
        for size_idx in range(len(cones)):
            # CRITICAL: Only try this cone size if we actually have it available
            if cones[size_idx] <= 0:
                continue
                
            for r in range(3):
                for c in range(3):
                    # Save original state BEFORE checking validity
                    original = board[r][c]
                    if self.is_valid_move(board, r, c, size_idx):
                        board[r][c] = {"player": 2, "size": size_idx}
                        if self.check_win(board, 2):
                            board[r][c] = original
                            return {"row": r, "col": c, "cone_size": size_idx}
                        board[r][c] = original
        return None

    def find_blocking_move(self, board, bot_cones):
        """Find a move to block opponent's winning move using bot's available cones"""
        # First, find where opponent could win
        for r in range(3):
            for c in range(3):
                if board[r][c] is None or self.is_valid_move(board, r, c, 2):  # Check if we can play here
                    original = board[r][c]
                    # Test if opponent placing here would win
                    board[r][c] = {"player": 1, "size": 2}  # Assume largest cone
                    if self.check_win(board, 1):
                        board[r][c] = original
                        # Find best cone size we have available to block this spot
                        for size_idx in [2, 1, 0]:  # Prefer larger cones
                            if size_idx < len(bot_cones) and bot_cones[size_idx] > 0 and self.is_valid_move(board, r, c, size_idx):
                                return {"row": r, "col": c, "cone_size": size_idx}
                    board[r][c] = original
        return None

    def get_random_move(self, board, cones):
        valid_moves = []
        # IMPORTANT: Only consider cones that are actually available (count > 0)
        for size_idx in range(len(cones)):
            # Skip if no cones of this size available
            if cones[size_idx] <= 0:
                continue
                
            for r in range(3):
                for c in range(3):
                    if self.is_valid_move(board, r, c, size_idx):
                        valid_moves.append({"row": r, "col": c, "cone_size": size_idx})
        
        if not valid_moves:
            return None
        return random.choice(valid_moves)

    def is_valid_move(self, board, r, c, size):
        """Check if a move is valid."""
        cell = board[r][c]
        if cell is None:
            return True
        
        # Cannot overwrite your own cones (bot is player 2)
        if cell['player'] == 2:
            return False
            
        # Can only overwrite with strictly larger cone
        return size > cell['size']

    def check_win(self, board, player):
        for i in range(3):
            if all(board[i][j] and board[i][j]['player'] == player for j in range(3)): 
                return True
            if all(board[j][i] and board[j][i]['player'] == player for j in range(3)): 
                return True
        if all(board[i][i] and board[i][i]['player'] == player for i in range(3)): 
            return True
        if all(board[i][2-i] and board[i][2-i]['player'] == player for i in range(3)): 
            return True
        return False
