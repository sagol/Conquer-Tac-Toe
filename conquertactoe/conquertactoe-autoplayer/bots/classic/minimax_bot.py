import random
from typing import Dict, Any, Optional
from core.bot_interface import IBot

class ClassicTicTacToeBot(IBot):
    """Simple Minimax-based bot for Classic Tic-Tac-Toe"""
    
    @property
    def name(self) -> str:
        return "Classic Minimax Bot"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get best move for Classic Tic-Tac-Toe using Minimax algorithm.
        Adapts the unified game_state to the internal logic.
        """
        board = game_state.get("board")
        # In classic, we always play as '2' (O) usually, but logic supports any
        # The original code assumed bot is player 2.
        player = 2 
        
        if not board:
            return None

        best_score = float('-inf')
        best_move = None
        
        # 3x3 board iteration
        for r in range(3):
            for c in range(3):
                if board[r][c] is None:
                    # Try this move
                    board[r][c] = {"player": player, "size": 0}
                    score = self.minimax(board, 0, False, player)
                    board[r][c] = None
                    
                    if score > best_score:
                        best_score = score
                        best_move = {"row": r, "col": c, "cone_size": 0}
        
        return best_move if best_move else self.get_random_move(board)
    
    def minimax(self, board, depth, is_maximizing, bot_player):
        """Minimax algorithm implementation"""
        opponent = 1 if bot_player == 2 else 2
        
        # Check terminal states
        if self.check_win(board, bot_player):
            return 10 - depth
        if self.check_win(board, opponent):
            return depth - 10
        if self.is_full(board):
            return 0
        
        if is_maximizing:
            best_score = float('-inf')
            for r in range(3):
                for c in range(3):
                    if board[r][c] is None:
                        board[r][c] = {"player": bot_player, "size": 0}
                        score = self.minimax(board, depth + 1, False, bot_player)
                        board[r][c] = None
                        best_score = max(score, best_score)
            return best_score
        else:
            best_score = float('inf')
            for r in range(3):
                for c in range(3):
                    if board[r][c] is None:
                        board[r][c] = {"player": opponent, "size": 0}
                        score = self.minimax(board, depth + 1, True, bot_player)
                        board[r][c] = None
                        best_score = min(score, best_score)
            return best_score
    
    def check_win(self, board, player):
        """Check if player has won"""
        # Rows and columns
        for i in range(3):
            if all(board[i][j] and board[i][j]['player'] == player for j in range(3)):
                return True
            if all(board[j][i] and board[j][i]['player'] == player for j in range(3)):
                return True
        # Diagonals
        if all(board[i][i] and board[i][i]['player'] == player for i in range(3)):
            return True
        if all(board[i][2-i] and board[i][2-i]['player'] == player for i in range(3)):
            return True
        return False
    
    def is_full(self, board):
        """Check if board is full"""
        return all(board[r][c] is not None for r in range(3) for c in range(3))
    
    def get_random_move(self, board):
        """Fallback random move"""
        valid_moves = [(r, c) for r in range(3) for c in range(3) if board[r][c] is None]
        if valid_moves:
            r, c = random.choice(valid_moves)
            return {"row": r, "col": c, "cone_size": 0}
        return None
