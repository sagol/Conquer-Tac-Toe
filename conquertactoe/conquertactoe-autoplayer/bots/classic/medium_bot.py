import random
from typing import Dict, Any, Optional
from core.bot_interface import IBot

class ClassicMediumBot(IBot):
    """Medium difficulty bot for Classic Tic-Tac-Toe"""
    
    def __init__(self):
        self.max_depth = 6  # Limited depth for medium difficulty
        self.transposition_table = {}  # Cache for positions
    
    @property
    def name(self) -> str:
        return "Classic Medium Bot"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get move using iterative deepening minimax with intelligent move ordering.
        """
        board = game_state.get("board")
        player = 2  # Bot is player 2
        
        if not board:
            return None

        # Clear transposition table for new position
        self.transposition_table.clear()
        
        best_score = float('-inf')
        best_move = None
        
        # Get moves with intelligent ordering (center → corners → edges)
        moves = self.get_ordered_moves(board)
        
        for r, c in moves:
            board[r][c] = {"player": player, "size": 0}
            score = self.minimax(board, 0, False, player, float('-inf'), float('inf'))
            board[r][c] = None
            
            if score > best_score:
                best_score = score
                best_move = {"row": r, "col": c, "cone_size": 0}
        
        return best_move if best_move else self.get_random_move(board)
    
    def get_ordered_moves(self, board):
        """
        Order moves intelligently: center → corners → edges
        This improves alpha-beta pruning efficiency
        """
        moves = []
        
        # Center first (best starting move in tic-tac-toe)
        if board[1][1] is None:
            return [(1, 1)]
        
        # Corners second (strategic positions)
        corners = [(0, 0), (0, 2), (2, 0), (2, 2)]
        for r, c in corners:
            if board[r][c] is None:
                moves.append((r, c))
        
        # Edges last
        edges = [(0, 1), (1, 0), (1, 2), (2, 1)]
        for r, c in edges:
            if board[r][c] is None:
                moves.append((r, c))
        
        return moves
    
    def minimax(self, board, depth, is_maximizing, bot_player, alpha, beta):
        """Minimax with alpha-beta pruning and transposition table"""
        # Check transposition table
        board_key = self.get_board_key(board)
        if board_key in self.transposition_table:
            return self.transposition_table[board_key]
        
        opponent = 1 if bot_player == 2 else 2
        
        # Check terminal states
        if self.check_win(board, bot_player):
            return 10 - depth  # Prefer faster wins
        if self.check_win(board, opponent):
            return depth - 10  # Avoid slower losses
        if self.is_full(board):
            return 0
        
        # Depth limit for medium difficulty
        if depth >= self.max_depth:
            return self.evaluate(board, bot_player)
        
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
                            break
                if beta <= alpha:
                    break
            self.transposition_table[board_key] = max_eval
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
                            break
                if beta <= alpha:
                    break
            self.transposition_table[board_key] = min_eval
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
    
    def evaluate(self, board, player):
        """Simple position evaluation for when depth limit is reached"""
        opponent = 1 if player == 2 else 2
        score = 0
        
        # Check all lines for potential wins
        lines = [
            # Rows
            [(0,0), (0,1), (0,2)], [(1,0), (1,1), (1,2)], [(2,0), (2,1), (2,2)],
            # Columns
            [(0,0), (1,0), (2,0)], [(0,1), (1,1), (2,1)], [(0,2), (1,2), (2,2)],
            # Diagonals
            [(0,0), (1,1), (2,2)], [(0,2), (1,1), (2,0)]
        ]
        
        for line in lines:
            player_count = sum(1 for r, c in line if board[r][c] and board[r][c]['player'] == player)
            opponent_count = sum(1 for r, c in line if board[r][c] and board[r][c]['player'] == opponent)
            empty_count = sum(1 for r, c in line if board[r][c] is None)
            
            # Only evaluate lines that are not blocked
            if player_count > 0 and opponent_count == 0:
                score += player_count ** 2  # Exponential reward for multiple pieces
            elif opponent_count > 0 and player_count == 0:
                score -= opponent_count ** 2
        
        return score
    
    def check_win(self, board, player):
        """Check if player has won"""
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
