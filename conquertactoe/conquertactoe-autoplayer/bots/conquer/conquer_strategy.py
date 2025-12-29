import random
from typing import List, Dict, Tuple, Optional, Set

class ConquerStrategy:
    """
    Shared strategy logic for Conquer-Tac-Toe bots.
    Handles move validation, win checking, and board evaluation.
    """

    def __init__(self):
        # Position values for heuristic evaluation
        self.POSITION_VALUES = {
            (1, 1): 5,  # Center
            (0, 0): 3, (0, 2): 3, (2, 0): 3, (2, 2): 3,  # Corners
            (0, 1): 1, (1, 0): 1, (1, 2): 1, (2, 1): 1   # Edges
        }

        # Winning lines indices
        self.WINNING_LINES = [
            [(0,0), (0,1), (0,2)], [(1,0), (1,1), (1,2)], [(2,0), (2,1), (2,2)], # Rows
            [(0,0), (1,0), (2,0)], [(0,1), (1,1), (2,1)], [(0,2), (1,2), (2,2)], # Cols
            [(0,0), (1,1), (2,2)], [(0,2), (1,1), (2,0)]                         # Diagonals
        ]

    def is_valid_move(self, board: List[List[Optional[Dict]]], r: int, c: int, size: int, player: int) -> bool:
        """
        Check if a move is valid.
        Rule: Can place on empty spot OR overwrite OPPONENT'S smaller piece.
        Cannot overwrite own piece.
        """
        cell = board[r][c]
        if cell is None:
            return True

        # Cannot overwrite own cones
        if cell['player'] == player:
            return False

        # Can only overwrite with strictly larger cone
        return size > cell['size']

    def check_win(self, board: List[List[Optional[Dict]]], player: int) -> bool:
        """Check if the given player has won."""
        for line in self.WINNING_LINES:
            if all(board[r][c] and board[r][c]['player'] == player for r, c in line):
                return True
        return False

    def generate_valid_moves(self, board: List[List[Optional[Dict]]], cones: List[int], player: int) -> List[Dict[str, int]]:
        """Generate all valid moves for the player given their available cones."""
        moves = []
        for size_idx in range(len(cones)):
            if cones[size_idx] <= 0:
                continue

            for r in range(3):
                for c in range(3):
                    if self.is_valid_move(board, r, c, size_idx, player):
                        moves.append({"row": r, "col": c, "cone_size": size_idx})
        return moves

    def evaluate_board(self, board: List[List[Optional[Dict]]], player: int, bot_cones: List[int], opponent_cones: List[int]) -> int:
        """
        Heuristic evaluation of the board state.
        Positive score favors 'player'.
        """
        score = 0
        opponent = 1 if player == 2 else 2

        # 1. Material / Position Control
        for r in range(3):
            for c in range(3):
                cell = board[r][c]
                if cell:
                    val = self.POSITION_VALUES.get((r, c), 1)
                    # Bonus for larger cones (harder to overwrite)
                    val += cell['size'] * 2

                    if cell['player'] == player:
                        score += val * 10
                    else:
                        score -= val * 10

        # 2. Line Control / Threats
        for line in self.WINNING_LINES:
            player_count = 0
            opponent_count = 0
            empty_count = 0

            for r, c in line:
                cell = board[r][c]
                if cell is None:
                    empty_count += 1
                elif cell['player'] == player:
                    player_count += 1
                else:
                    opponent_count += 1

            # 2 in a row (Threat) - but verify empty cell is PLAYABLE
            if player_count == 2 and empty_count == 1:
                # Find the empty cell and check if we can play there
                empty_cell = None
                for r, c in line:
                    if board[r][c] is None:
                        empty_cell = (r, c)
                        break
                
                if empty_cell:
                    # Check if we have any cone that can play there
                    can_play = any(count > 0 for count in bot_cones)
                    if can_play:
                        score += 50
            
            if opponent_count == 2 and empty_count == 1:
                # Find empty cell and check if it's defensible
                empty_cell = None
                for r, c in line:
                    if board[r][c] is None:
                        empty_cell = (r, c)
                        break
                
                if empty_cell:
                    r, c = empty_cell
                    cell = board[r][c]
                    # Check if we can actually play here to block
                    if cell is None:
                        can_block = any(count > 0 for count in bot_cones)
                    else:
                        # Cell occupied - can we overwrite it?
                        can_block = any(i > cell['size'] and count > 0 
                                      for i, count in enumerate(bot_cones))
                    
                    if can_block:
                        score -= 60  # Defensive priority

            # Blocked lines are less valuable, but owning pieces is still good (handled by material score)

        # 3. Cone Economy
        # Having more/larger cones remaining is good
        # Nonlinear weighting: larger cones are disproportionately valuable
        player_inventory_val = sum((i + 1) ** 1.5 * count for i, count in enumerate(bot_cones))
        opponent_inventory_val = sum((i + 1) ** 1.5 * count for i, count in enumerate(opponent_cones))

        score += (player_inventory_val - opponent_inventory_val) * 5

        return score

    def get_random_move(self, board: List[List[Optional[Dict]]], cones: List[int], player: int) -> Optional[Dict[str, int]]:
        """Get a random valid move."""
        moves = self.generate_valid_moves(board, cones, player)
        if not moves:
            return None
        return random.choice(moves)
