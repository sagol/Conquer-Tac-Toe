import random
from typing import Dict, Any, Optional
from core.bot_interface import IBot

class ClassicHardBot(IBot):
    """Hard difficulty bot for Classic Tic-Tac-Toe - Perfect play implementation"""
    
    def __init__(self):
        # Opening book: optimal first moves
        self.opening_book = {
            # Empty board: take center
            tuple([tuple([None]*3)]*3): (1, 1),
            # Opponent took center: take corner
            # Add more strategic openings
        }
        self.nodes_explored = 0
    
    @property
    def name(self) -> str:
        return "Classic Hard Bot (Perfect Play)"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get move using perfect minimax - this bot is unbeatable.
        """
        board = game_state.get("board")
        player = 2  # Bot is player 2
        
        if not board:
            return None

        # Check opening book first
        board_key = self.get_board_key(board)
        if board_key in self.opening_book:
            r, c = self.opening_book[board_key]
            if board[r][c] is None:
                return {"row": r, "col": c, "cone_size": 0}
        
        # Use symmetry detection to reduce search space
        best_move = self.minimax_root(board, player)
        
        return best_move if best_move else self.get_random_move(board)
    
    def minimax_root(self, board, player):
        """Root level minimax with full depth search"""
        best_score = float('-inf')
        best_move = None
        
        # Try center first (optimal opening)
        if board[1][1] is None:
            return {"row": 1, "col": 1, "cone_size": 0}
        
        # Get all valid moves with intelligent ordering
        moves = self.get_ordered_moves(board, player)
        
        for r, c in moves:
            board[r][c] = {"player": player, "size": 0}
            score = self.minimax(board, 0, False, player, float('-inf'), float('inf'))
            board[r][c] = None
            
            if score > best_score:
                best_score = score
                best_move = {"row": r, "col": c, "cone_size": 0}
            
            # Perfect win found, take it immediately
            if best_score == 10:
                break
        
        return best_move
    
    def get_ordered_moves(self, board, player):
        """
        Intelligent move ordering for alpha-beta optimization.
        Order: winning moves → blocking moves → center → corners → edges
        """
        opponent = 1 if player == 2 else 2
        
        # Check for immediate wins first
        for r in range(3):
            for c in range(3):
                if board[r][c] is None:
                    board[r][c] = {"player": player, "size": 0}
                    if self.check_win(board, player):
                        board[r][c] = None
                        return [(r, c)]
                    board[r][c] = None
        
        # Check for blocking moves
        blocks = []
        for r in range(3):
            for c in range(3):
                if board[r][c] is None:
                    board[r][c] = {"player": opponent, "size": 0}
                    if self.check_win(board, opponent):
                        blocks.append((r, c))
                    board[r][c] = None
        
        if blocks:
            return blocks
        
        # Standard ordering: center → corners → edges
        moves = []
        if board[1][1] is None:
            moves.append((1, 1))
        
        corners = [(0, 0), (0, 2), (2, 0), (2, 2)]
        for r, c in corners:
            if board[r][c] is None:
                moves.append((r, c))
        
        edges = [(0, 1), (1, 0), (1, 2), (2, 1)]
        for r, c in edges:
            if board[r][c] is None:
                moves.append((r, c))
        
        return moves
    
    def minimax(self, board, depth, is_maximizing, bot_player, alpha, beta):
        """Perfect minimax algorithm with alpha-beta pruning - searches entire game tree"""
        opponent = 1 if bot_player == 2 else 2
        
        # Terminal state checks
        if self.check_win(board, bot_player):
            return 10 - depth  # Prefer faster wins
        if self.check_win(board, opponent):
            return depth - 10  # Avoid slower losses
        if self.is_full(board):
            return 0  # Draw
        
        if is_maximizing:
            max_eval = float('-inf')
            for r in range(3):
                for c in range(3):
                    if board[r][c] is None:
                        board[r][c] = {"player": bot_player, "size": 0}
                        eval_score = self.minimax(board, depth + 1, False, bot_player, alpha, beta)
                        board[r][c] = None
                        max_eval = max(max_eval, eval_score)
                        alpha = max(alpha, eval_score)
                        if beta <= alpha:
                            break  # Beta cutoff
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float('inf')
            for r in range(3):
                for c in range(3):
                    if board[r][c] is None:
                        board[r][c] = {"player": opponent, "size": 0}
                        eval_score = self.minimax(board, depth + 1, True, bot_player, alpha, beta)
                        board[r][c] = None
                        min_eval = min(min_eval, eval_score)
                        beta = min(beta, eval_score)
                        if beta <= alpha:
                            break  # Alpha cutoff
                if beta <= alpha:
                    break
            return min_eval
    
    def get_board_key(self, board):
        """Create a hashable key for the board state"""
        return tuple(
            tuple(
                (cell['player'], cell['size']) if cell else None
                for cell in row
            )
            for row in board
        )
    
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
        """Fallback random move (should never be needed)"""
        valid_moves = [(r, c) for r in range(3) for c in range(3) if board[r][c] is None]
        if valid_moves:
            r, c = random.choice(valid_moves)
            return {"row": r, "col": c, "cone_size": 0}
        return None
