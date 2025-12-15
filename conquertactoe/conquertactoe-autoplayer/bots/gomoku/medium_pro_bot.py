"""
Medium Pro Gomoku Bot

Based on the hard bot from main branch, optimized for speed:
- Reduced search depth (4 instead of 6)
- Reduced VCF depth (6 instead of 12)
- Smaller candidate pool (20 instead of 30)
- Shorter time limit (2.5s instead of 5s)
- Same logic and pattern recognition
"""

import time
from typing import Dict, Any, Optional
from core.bot_interface import IBot
from .gomoku_strategy import GomokuStrategy


class GomokuMediumProBot(IBot):
    """
    Medium Pro Gomoku bot:
    - Uses shared GomokuStrategy for robust evaluation
    - Medium-deep search (Depth 4)
    - VCF (Victory by Continuous Forcing) search
    - Move ordering with killer heuristic
    - Defense-first scoring
    """

    def __init__(self):
        self.strategy = GomokuStrategy()
        self.max_depth = 4  # Reduced from 6 for speed
        self.max_time = 2.5  # Reduced from 5.0 for speed
        self.transposition_table = {}
        self.killer_moves = {}

    @property
    def name(self) -> str:
        return "Gomoku Medium Pro Bot"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        board = game_state.get("board")
        if not board:
            return None

        board_size = len(board)
        player = 2

        # 1. Opening Move (Optimal)
        opening_move = self.strategy.get_opening_move(board, player, board_size)
        if opening_move:
            return opening_move

        # 2. Check for immediate win
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        for r, c in candidates:
            board[r][c] = {"player": player, "size": 0}
            if self.strategy.check_win(board, player, board_size):
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}
            board[r][c] = None

        # 3. Check for must-block moves
        opponent = 1
        for r, c in candidates:
            board[r][c] = {"player": opponent, "size": 0}
            if self.strategy.check_win(board, opponent, board_size):
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}
            board[r][c] = None

        # 4. VCF Search (reduced depth for speed)
        vcf_move = self.find_vcf_sequence(board, player, board_size, max_depth=6)
        if vcf_move:
            return vcf_move

        # 5. Minimax Search with defense-first scoring
        best_move = self.minimax_search(board, player, board_size)
        return best_move

    def minimax_search(self, board, player, board_size):
        start_time = time.time()
        self.transposition_table.clear()
        self.killer_moves.clear()

        candidates = self.strategy.generate_candidate_moves(board, board_size)
        if not candidates:
            return None

        opponent = 1 if player == 2 else 2

        # Defense-first scoring for move ordering
        scored_moves = []
        for r, c in candidates:
            score = 0

            # Center preference
            center = board_size // 2
            dist = abs(r - center) + abs(c - center)
            score += max(0, 10 - dist)

            # Check our offense
            board[r][c] = {"player": player, "size": 0}
            if self.strategy.check_win(board, player, board_size):
                score += 1000000
            eval_score = self.strategy.evaluate_board(board, player, board_size)
            if eval_score > 50000:
                score += 50000  # Creates four
            elif eval_score > 2000:
                score += 5000  # Creates three
            board[r][c] = None

            # DEFENSE > OFFENSE
            board[r][c] = {"player": opponent, "size": 0}
            if self.strategy.check_win(board, opponent, board_size):
                score += 500000  # Must block
            opp_eval = self.strategy.evaluate_board(board, opponent, board_size)
            if opp_eval > 50000:
                score += 100000  # Blocks four
            elif opp_eval > 2000:
                score += 60000  # Blocks three (higher than creates four!)
            board[r][c] = None

            # Zone control bonus
            score += self.evaluate_zone_control_fast(r, c, board_size)

            scored_moves.append(((r, c), score))

        scored_moves.sort(key=lambda x: x[1], reverse=True)
        top_moves = [m[0] for m in scored_moves[:20]]  # Reduced from 30

        # If top move is critical (must-block or win), return immediately
        if scored_moves and scored_moves[0][1] >= 60000:
            return {"row": scored_moves[0][0][0], "col": scored_moves[0][0][1], "cone_size": 0}

        best_score = float('-inf')
        best_move = top_moves[0] if top_moves else None
        alpha = float('-inf')
        beta = float('inf')

        for r, c in top_moves:
            if time.time() - start_time > self.max_time:
                break

            board[r][c] = {"player": player, "size": 0}
            score = self.minimax(
                board, self.max_depth - 1, False, alpha, beta,
                player, board_size, start_time, 1
            )
            board[r][c] = None

            if score > best_score:
                best_score = score
                best_move = (r, c)

            alpha = max(alpha, score)

        if best_move:
            return {"row": best_move[0], "col": best_move[1], "cone_size": 0}
        return None

    def minimax(self, board, depth, is_maximizing, alpha, beta, bot_player, board_size, start_time, ply):
        if time.time() - start_time > self.max_time:
            return self.evaluate_position(board, bot_player, board_size)

        board_key = self.get_board_key(board, board_size)
        if board_key in self.transposition_table:
            return self.transposition_table[board_key]

        opponent = 1 if bot_player == 2 else 2
        current_player = bot_player if is_maximizing else opponent

        # Check if previous move won
        prev_player = opponent if is_maximizing else bot_player
        if self.strategy.check_win(board, prev_player, board_size):
            return -100000 - depth if is_maximizing else 100000 + depth

        if depth == 0:
            eval_score = self.evaluate_position(board, bot_player, board_size)
            self.transposition_table[board_key] = eval_score
            return eval_score

        # Get moves with killer heuristic
        candidates = self.get_ordered_moves(board, current_player, board_size, ply)

        if is_maximizing:
            max_eval = float('-inf')
            for r, c in candidates[:12]:  # Reduced from 15
                board[r][c] = {"player": bot_player, "size": 0}
                eval_val = self.minimax(
                    board, depth - 1, False, alpha, beta,
                    bot_player, board_size, start_time, ply + 1
                )
                board[r][c] = None

                if eval_val > max_eval:
                    max_eval = eval_val
                    # Update killer move
                    if ply not in self.killer_moves:
                        self.killer_moves[ply] = []
                    if (r, c) not in self.killer_moves[ply]:
                        self.killer_moves[ply].insert(0, (r, c))

                alpha = max(alpha, eval_val)
                if beta <= alpha:
                    break

            self.transposition_table[board_key] = max_eval
            return max_eval
        else:
            min_eval = float('inf')
            for r, c in candidates[:12]:
                board[r][c] = {"player": opponent, "size": 0}
                eval_val = self.minimax(
                    board, depth - 1, True, alpha, beta,
                    bot_player, board_size, start_time, ply + 1
                )
                board[r][c] = None
                min_eval = min(min_eval, eval_val)
                beta = min(beta, eval_val)
                if beta <= alpha:
                    break

            self.transposition_table[board_key] = min_eval
            return min_eval

    def evaluate_position(self, board, player, board_size):
        """Evaluate position for the given player."""
        return self.strategy.evaluate_board(board, player, board_size)

    def evaluate_zone_control_fast(self, r, c, board_size):
        """Fast zone control score based on position only."""
        center = board_size // 2
        distance = abs(r - center) + abs(c - center)
        return max(0, (5 - distance) * 2)

    def get_ordered_moves(self, board, player, board_size, ply):
        """Get moves with killer heuristic."""
        candidates = list(self.strategy.generate_candidate_moves(board, board_size))

        # Prioritize killer moves
        killers = self.killer_moves.get(ply, [])
        ordered_moves = []

        for km in killers:
            if km in candidates:
                ordered_moves.append(km)
                candidates.remove(km)

        ordered_moves.extend(candidates)
        return ordered_moves

    def find_vcf_sequence(self, board, player, board_size, depth=0, max_depth=6):
        """VCF search with reduced depth for speed."""
        if depth >= max_depth:
            return None

        candidates = self.strategy.generate_candidate_moves(board, board_size)

        # Find forcing moves (creates 4 or open 3)
        forcing_moves = []
        for r, c in candidates:
            board[r][c] = {"player": player, "size": 0}

            # Check if this move wins immediately
            if self.strategy.check_win(board, player, board_size):
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}

            # Check if it creates a strong threat
            score = self.strategy.evaluate_board(board, player, board_size)
            if score > 5000:  # Creates 4 or better
                forcing_moves.append((r, c))

            board[r][c] = None

        # Try forcing moves
        for r, c in forcing_moves[:5]:  # Limit for speed
            board[r][c] = {"player": player, "size": 0}
            next_move = self.find_vcf_sequence(board, player, board_size, depth + 1, max_depth)
            board[r][c] = None

            if next_move:
                return {"row": r, "col": c, "cone_size": 0}

        return None

    def get_board_key(self, board, board_size):
        """Generate a hashable key for the board state."""
        key_list = []
        for r in range(min(board_size, len(board))):
            for c in range(min(board_size, len(board[r]) if r < len(board) else 0)):
                cell = board[r][c] if r < len(board) and c < len(board[r]) else None
                if cell:
                    key_list.append((r, c, cell['player']))
        return tuple(key_list)
