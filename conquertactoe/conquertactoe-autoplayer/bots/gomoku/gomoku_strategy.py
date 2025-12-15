import random
from typing import List, Dict, Tuple, Optional, Set

# Direction vectors: (dr, dc)
DIRECTIONS = [(0, 1), (1, 0), (1, 1), (1, -1)]

class GomokuStrategy:
    """
    Shared strategy logic for Gomoku bots.
    Implements pattern recognition, evaluation, and move generation.
    
    Optimized version with:
    - Pre-compiled pattern scores
    - Faster line evaluation using counting
    - Improved candidate move ordering
    """

    def __init__(self):
        # Pattern scores - tuned for better play
        self.SCORES = {
            'five': 1000000,
            'open_four': 100000,   # Unstoppable win in 1
            'four': 15000,         # Forced defense
            'open_three': 3000,    # Major threat
            'broken_three': 800,   # Minor threat
            'three': 200,
            'open_two': 50,
            'two': 15
        }
        
        # Pre-compile pattern matchers for faster lookup
        self._init_pattern_scores()

    def _init_pattern_scores(self):
        """Pre-compute pattern to score mapping for fast lookup"""
        # Player patterns (X = player stone, _ = empty, O = opponent)
        self.player_patterns = [
            ('XXXXX', self.SCORES['five']),
            ('_XXXX_', self.SCORES['open_four']),
            ('_XXXX', self.SCORES['four']),
            ('XXXX_', self.SCORES['four']),
            ('X_XXX', self.SCORES['four']),
            ('XXX_X', self.SCORES['four']),
            ('XX_XX', self.SCORES['four']),
            ('_XXX_', self.SCORES['open_three']),
            ('_X_XX_', self.SCORES['broken_three']),
            ('_XX_X_', self.SCORES['broken_three']),
            ('__XXX', self.SCORES['three']),
            ('XXX__', self.SCORES['three']),
            ('_XXX', self.SCORES['three']),
            ('XXX_', self.SCORES['three']),
            ('_XX_', self.SCORES['open_two']),
            ('__XX', self.SCORES['two']),
            ('XX__', self.SCORES['two']),
        ]
        
        # Opponent patterns (same structure, used for defense)
        self.opponent_patterns = [
            ('OOOOO', self.SCORES['five']),
            ('_OOOO_', self.SCORES['open_four']),
            ('_OOOO', self.SCORES['four']),
            ('OOOO_', self.SCORES['four']),
            ('O_OOO', self.SCORES['four']),
            ('OOO_O', self.SCORES['four']),
            ('OO_OO', self.SCORES['four']),
            ('_OOO_', self.SCORES['open_three']),
            ('_O_OO_', self.SCORES['broken_three']),
            ('_OO_O_', self.SCORES['broken_three']),
            ('__OOO', self.SCORES['three']),
            ('OOO__', self.SCORES['three']),
            ('_OOO', self.SCORES['three']),
            ('OOO_', self.SCORES['three']),
            ('_OO_', self.SCORES['open_two']),
            ('__OO', self.SCORES['two']),
            ('OO__', self.SCORES['two']),
        ]

    def get_opening_move(self, board: List[List[Optional[Dict]]], player: int, board_size: int) -> Optional[Dict[str, int]]:
        """Get a strategic opening move."""
        actual_board_size = len(board)
        
        # Count pieces
        piece_count = sum(1 for r in range(actual_board_size) for c in range(actual_board_size)
                         if r < len(board) and c < len(board[r]) and board[r][c] is not None)
        
        center = actual_board_size // 2
        
        # Move 1: Center
        if piece_count == 0:
            return {"row": center, "col": center, "cone_size": 0}
        
        # Move 2: Near center
        elif piece_count == 1:
            if board[center][center] is not None:
                # Play diagonal (strongest response)
                offsets = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
                for dr, dc in offsets:
                    r, c = center + dr, center + dc
                    if 0 <= r < actual_board_size and 0 <= c < actual_board_size and board[r][c] is None:
                        return {"row": r, "col": c, "cone_size": 0}
                # Fallback to adjacent
                offsets = [(0, 1), (1, 0), (0, -1), (-1, 0)]
                for dr, dc in offsets:
                    r, c = center + dr, center + dc
                    if 0 <= r < actual_board_size and 0 <= c < actual_board_size and board[r][c] is None:
                        return {"row": r, "col": c, "cone_size": 0}
            else:
                return {"row": center, "col": center, "cone_size": 0}
        
        # Move 3-4: Build towards pattern
        elif piece_count <= 3:
            # Find our pieces and extend them
            our_pieces = []
            for r in range(actual_board_size):
                for c in range(actual_board_size):
                    if board[r][c] and board[r][c]['player'] == player:
                        our_pieces.append((r, c))
            
            if our_pieces:
                # Try to extend from first piece in a diagonal or straight line
                base_r, base_c = our_pieces[0]
                for dr, dc in [(1, 1), (1, 0), (0, 1), (1, -1)]:
                    for dist in [2, 1, -1, -2]:
                        nr, nc = base_r + dr * dist, base_c + dc * dist
                        if 0 <= nr < actual_board_size and 0 <= nc < actual_board_size:
                            if board[nr][nc] is None:
                                return {"row": nr, "col": nc, "cone_size": 0}
                
        return None

    def evaluate_board(self, board: List[List[Optional[Dict]]], player: int, board_size: int) -> int:
        """
        Evaluate the entire board state for the given player.
        Positive score favors 'player'.
        """
        score = 0
        opponent = 1 if player == 2 else 2
        
        # Collect all lines to evaluate
        lines = []
        
        # Horizontal
        for r in range(board_size):
            if r < len(board):
                lines.append(board[r][:board_size])
        
        # Vertical
        for c in range(board_size):
            col = [board[r][c] if r < len(board) and c < len(board[r]) else None for r in range(board_size)]
            lines.append(col)
        
        # Diagonals (only those with length >= 5)
        for start_r in range(board_size):
            # Down-right from left edge
            line = []
            r, c = start_r, 0
            while r < board_size and c < board_size:
                if r < len(board) and c < len(board[r]):
                    line.append(board[r][c])
                r += 1
                c += 1
            if len(line) >= 5:
                lines.append(line)
        
        for start_c in range(1, board_size):
            # Down-right from top edge
            line = []
            r, c = 0, start_c
            while r < board_size and c < board_size:
                if r < len(board) and c < len(board[r]):
                    line.append(board[r][c])
                r += 1
                c += 1
            if len(line) >= 5:
                lines.append(line)
        
        for start_r in range(board_size):
            # Down-left from right edge
            line = []
            r, c = start_r, board_size - 1
            while r < board_size and c >= 0:
                if r < len(board) and c < len(board[r]):
                    line.append(board[r][c])
                r += 1
                c -= 1
            if len(line) >= 5:
                lines.append(line)
        
        for start_c in range(board_size - 2, -1, -1):
            # Down-left from top edge
            line = []
            r, c = 0, start_c
            while r < board_size and c >= 0:
                if r < len(board) and c < len(board[r]):
                    line.append(board[r][c])
                r += 1
                c -= 1
            if len(line) >= 5:
                lines.append(line)
        
        # Evaluate all lines
        for line in lines:
            score += self._evaluate_line_fast(line, player, opponent)
        
        return int(score)

    def _evaluate_line_fast(self, line: List[Optional[Dict]], player: int, opponent: int) -> float:
        """
        Fast line evaluation using pattern matching.
        """
        length = len(line)
        if length < 5:
            return 0
        
        # Convert to string representation
        chars = []
        for cell in line:
            if cell is None:
                chars.append('_')
            elif cell['player'] == player:
                chars.append('X')
            else:
                chars.append('O')
        
        s = ''.join(chars)
        score = 0.0
        
        # Check player patterns
        for pattern, value in self.player_patterns:
            if pattern in s:
                score += value
        
        # Check opponent patterns (defensive - weighted higher)
        defense_weight = 1.15
        for pattern, value in self.opponent_patterns:
            if pattern in s:
                score -= value * defense_weight
        
        return score

    def generate_candidate_moves(self, board: List[List[Optional[Dict]]], board_size: int) -> List[Tuple[int, int]]:
        """
        Generate interesting moves (near existing stones).
        Returns moves sorted by proximity to center and existing pieces.
        """
        candidates = set()
        actual_board_size = len(board)
        center = actual_board_size // 2
        
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
            return [(center, center)]
        
        # Sort candidates by distance to center (prefer central moves)
        sorted_candidates = sorted(
            candidates,
            key=lambda pos: abs(pos[0] - center) + abs(pos[1] - center)
        )
        
        return sorted_candidates

    def check_win(self, board: List[List[Optional[Dict]]], player: int, board_size: int) -> bool:
        """Check if 'player' has won."""
        actual_size = min(board_size, len(board))
        
        # Horizontal
        for r in range(actual_size):
            count = 0
            for c in range(actual_size):
                if r < len(board) and c < len(board[r]) and board[r][c] and board[r][c]['player'] == player:
                    count += 1
                    if count >= 5:
                        return True
                else:
                    count = 0
        
        # Vertical
        for c in range(actual_size):
            count = 0
            for r in range(actual_size):
                if r < len(board) and c < len(board[r]) and board[r][c] and board[r][c]['player'] == player:
                    count += 1
                    if count >= 5:
                        return True
                else:
                    count = 0
        
        # Diagonal (down-right)
        for start in range(actual_size):
            # From top row
            count = 0
            r, c = 0, start
            while r < actual_size and c < actual_size:
                if r < len(board) and c < len(board[r]) and board[r][c] and board[r][c]['player'] == player:
                    count += 1
                    if count >= 5:
                        return True
                else:
                    count = 0
                r += 1
                c += 1
            
            # From left column
            if start > 0:
                count = 0
                r, c = start, 0
                while r < actual_size and c < actual_size:
                    if r < len(board) and c < len(board[r]) and board[r][c] and board[r][c]['player'] == player:
                        count += 1
                        if count >= 5:
                            return True
                    else:
                        count = 0
                    r += 1
                    c += 1
        
        # Diagonal (down-left)
        for start in range(actual_size):
            # From top row
            count = 0
            r, c = 0, start
            while r < actual_size and c >= 0:
                if r < len(board) and c < len(board[r]) and board[r][c] and board[r][c]['player'] == player:
                    count += 1
                    if count >= 5:
                        return True
                else:
                    count = 0
                r += 1
                c -= 1
            
            # From right column
            if start < actual_size - 1:
                count = 0
                r, c = start, actual_size - 1
                while r < actual_size and c >= 0:
                    if r < len(board) and c < len(board[r]) and board[r][c] and board[r][c]['player'] == player:
                        count += 1
                        if count >= 5:
                            return True
                    else:
                        count = 0
                    r += 1
                    c -= 1
        
        return False

    def get_threat_level(self, board: List[List[Optional[Dict]]], player: int, board_size: int) -> int:
        """
        Get the highest threat level on the board for a player.
        Returns: 5 (win), 4 (four), 3 (open three), etc.
        """
        score = self.evaluate_board(board, player, board_size)
        if score >= self.SCORES['five']:
            return 5
        elif score >= self.SCORES['open_four']:
            return 4
        elif score >= self.SCORES['four']:
            return 4
        elif score >= self.SCORES['open_three']:
            return 3
        elif score >= self.SCORES['broken_three']:
            return 3
        return 0
