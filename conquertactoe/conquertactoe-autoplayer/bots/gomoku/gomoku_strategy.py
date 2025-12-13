import random
from typing import List, Dict, Tuple, Optional, Set

# Direction vectors: (dr, dc)
DIRECTIONS = [(0, 1), (1, 0), (1, 1), (1, -1)]

class GomokuStrategy:
    """
    Shared strategy logic for Gomoku bots.
    Implements pattern recognition, evaluation, and move generation.
    """

    def __init__(self):
        # Pattern scores
        self.SCORES = {
            'five': 1000000,
            'open_four': 100000,  # Unstoppable win in 1
            'four': 10000,        # Forced defense
            'open_three': 1000,   # Major threat
            'broken_three': 500,  # Minor threat
            'three': 100,
            'two': 10
        }

    def get_opening_move(self, board: List[List[Optional[Dict]]], player: int, board_size: int) -> Optional[Dict[str, int]]:
        """
        Get a strategic opening move.
        """
        actual_board_size = len(board)
        
        # Count pieces
        piece_count = sum(1 for r in range(actual_board_size) for c in range(actual_board_size)
                         if r < len(board) and c < len(board[r]) and board[r][c] is not None)
        
        # Move 1: Center
        if piece_count == 0:
            center = actual_board_size // 2
            return {"row": center, "col": center, "cone_size": 0}
        
        # Move 2: Near center
        elif piece_count == 1:
            center = actual_board_size // 2
            # Check where the first piece is
            if board[center][center] is not None:
                # Play diagonal or adjacent
                offsets = [(0,1), (1,0), (1,1), (-1,1), (-1,-1), (0,-1), (-1,0), (1,-1)]
                valid_offsets = []
                for dr, dc in offsets:
                    r, c = center + dr, center + dc
                    if 0 <= r < actual_board_size and 0 <= c < actual_board_size:
                        valid_offsets.append((r, c))
                
                if valid_offsets:
                    r, c = random.choice(valid_offsets)
                    return {"row": r, "col": c, "cone_size": 0}
            else:
                # If opponent didn't play center, take center
                return {"row": center, "col": center, "cone_size": 0}
                
        return None

    def evaluate_board(self, board: List[List[Optional[Dict]]], player: int, board_size: int) -> int:
        """
        Evaluate the entire board state for the given player.
        Positive score favors 'player'.
        """
        score = 0
        opponent = 1 if player == 2 else 2
        
        # Scan all lines (Horizontal, Vertical, Diagonals)
        
        # Horizontal
        for r in range(board_size):
            score += self._evaluate_line(board[r], player, opponent)
            
        # Vertical
        for c in range(board_size):
            col = [board[r][c] for r in range(board_size)]
            score += self._evaluate_line(col, player, opponent)
            
        # Main diagonals (top-left to bottom-right)
        # Start from col 0 for each row, and row 0 for each col
        # We only care about diagonals with length >= 5
        for k in range(board_size * 2 - 1):
            line = []
            for j in range(k + 1):
                i = k - j
                if 0 <= i < board_size and 0 <= j < board_size:
                    line.append(board[i][j])
            if len(line) >= 5:
                score += self._evaluate_line(line, player, opponent)

        # Anti-diagonals (top-right to bottom-left)
        for k in range(board_size * 2 - 1):
            line = []
            for j in range(k + 1):
                i = k - j
                if 0 <= i < board_size and 0 <= board_size - 1 - j < board_size:
                    line.append(board[i][board_size - 1 - j])
            if len(line) >= 5:
                score += self._evaluate_line(line, player, opponent)

        return score

    def _evaluate_line(self, line: List[Optional[Dict]], player: int, opponent: int) -> int:
        """
        Evaluate a single line (list of cells) for patterns using string matching.
        """
        score = 0
        length = len(line)
        if length < 5:
            return 0
            
        # Convert line to string representation: 'X' (player), 'O' (opponent), '_' (empty)
        line_str = []
        for cell in line:
            if cell is None:
                line_str.append('_')
            elif cell['player'] == player:
                line_str.append('X')
            else:
                line_str.append('O')
        
        s = "".join(line_str)
        
        # Define patterns
        # Note: We prioritize longer patterns first to avoid double counting if possible,
        # but simple summation is standard for heuristic evaluation.
        
        # Player Patterns (Positive Score)
        if 'XXXXX' in s:
            score += self.SCORES['five']
        if '_XXXX_' in s:
            score += self.SCORES['open_four']
        if '_XXXX' in s or 'XXXX_' in s or 'X_XXX' in s or 'XXX_X' in s or 'XX_XX' in s:
            # Note: _XXXX_ is already counted above, but adding more for being "four" is okay
            # or we can use elif to be exclusive. 
            # For simplicity and strength, we sum them up.
            score += self.SCORES['four']
        if '_XXX_' in s:
            score += self.SCORES['open_three']
        if '_X_XX_' in s or '_XX_X_' in s:
            score += self.SCORES['broken_three']
        if '_XXX' in s or 'XXX_' in s:
            score += self.SCORES['three']
        if '_XX_' in s:
            score += self.SCORES['two']

        # Opponent Patterns (Negative Score - Defensive)
        # We multiply by a factor > 1 to prioritize defense
        def_factor = 1.2
        
        if 'OOOOO' in s:
            score -= self.SCORES['five'] * def_factor
        if '_OOOO_' in s:
            score -= self.SCORES['open_four'] * def_factor
        if '_OOOO' in s or 'OOOO_' in s or 'O_OOO' in s or 'OOO_O' in s or 'OO_OO' in s:
            score -= self.SCORES['four'] * def_factor
        if '_OOO_' in s:
            score -= self.SCORES['open_three'] * def_factor
        if '_O_OO_' in s or '_OO_O_' in s:
            score -= self.SCORES['broken_three'] * def_factor
        if '_OOO' in s or 'OOO_' in s:
            score -= self.SCORES['three'] * def_factor
        if '_OO_' in s:
            score -= self.SCORES['two'] * def_factor
                
        return score

    def generate_candidate_moves(self, board: List[List[Optional[Dict]]], board_size: int) -> List[Tuple[int, int]]:
        """
        Generate interesting moves (near existing stones).
        """
        candidates = set()
        actual_board_size = len(board)
        
        has_pieces = False
        for r in range(actual_board_size):
            for c in range(actual_board_size):
                if board[r][c] is not None:
                    has_pieces = True
                    # Add neighbors (radius 2)
                    for dr in range(-2, 3):
                        for dc in range(-2, 3):
                            if dr == 0 and dc == 0:
                                continue
                            nr, nc = r + dr, c + dc
                            if 0 <= nr < actual_board_size and 0 <= nc < actual_board_size:
                                if board[nr][nc] is None:
                                    candidates.add((nr, nc))
        
        if not has_pieces:
            center = actual_board_size // 2
            return [(center, center)]
            
        return list(candidates)

    def check_win(self, board: List[List[Optional[Dict]]], player: int, board_size: int) -> bool:
        """
        Check if 'player' has won.
        """
        # Horizontal
        for r in range(board_size):
            for c in range(board_size - 4):
                if all(board[r][c+k] and board[r][c+k]['player'] == player for k in range(5)):
                    return True
        
        # Vertical
        for r in range(board_size - 4):
            for c in range(board_size):
                if all(board[r+k][c] and board[r+k][c]['player'] == player for k in range(5)):
                    return True
                    
        # Diagonal (down-right)
        for r in range(board_size - 4):
            for c in range(board_size - 4):
                if all(board[r+k][c+k] and board[r+k][c+k]['player'] == player for k in range(5)):
                    return True
                    
        # Diagonal (up-right)
        for r in range(4, board_size):
            for c in range(board_size - 4):
                if all(board[r-k][c+k] and board[r-k][c+k]['player'] == player for k in range(5)):
                    return True
                    
        return False
