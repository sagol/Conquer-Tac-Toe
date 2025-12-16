import random
from typing import Dict, Any, Optional, List
from core.bot_interface import IBot
from .conquer_strategy import ConquerStrategy

class ConquerHardBot(IBot):
    """
    Hard difficulty bot for Conquer variants (Expert).
    - Uses shared ConquerStrategy
    - Deep Minimax Search (Depth 6+) with Alpha-Beta Pruning
    - Endgame Solver (Exhaustive search when pieces <= 9)
    - Advanced Evaluation
    """

    def __init__(self):
        self.strategy = ConquerStrategy()
        self.max_depth = 6

    @property
    def name(self) -> str:
        return "Conquer Hard Bot (Expert)"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        board = game_state.get("board")
        bot_cones = game_state.get("bot_cones")
        player_cones = game_state.get("player_cones")

        if not board or not bot_cones:
            return None

        # 1. Endgame Solver
        # If total pieces remaining is small, solve perfectly
        total_pieces = sum(c for c in bot_cones if c < 900) + sum(c for c in player_cones if c < 900)
        if total_pieces <= 9:
            best_move = self.solve_endgame(board, bot_cones, player_cones)
            if best_move:
                return best_move

        # 2. Deep Minimax with Alpha-Beta
        best_move = self.minimax_search(board, bot_cones, player_cones)

        if best_move:
            return best_move

        # Fallback
        return self.strategy.get_random_move(board, bot_cones, 2)

    def solve_endgame(self, board, bot_cones, player_cones):
        """Exhaustive search for endgame"""
        # We use the same minimax but with infinite depth (or very high)
        # and no heuristic evaluation at leaf nodes unless terminal
        return self.minimax_search(board, bot_cones, player_cones, depth=12)

    def minimax_search(self, board, bot_cones, player_cones, depth=None):
        search_depth = depth if depth is not None else self.max_depth
        best_score = float('-inf')
        best_move = None
        alpha = float('-inf')
        beta = float('inf')

        # Generate moves
        moves = self.strategy.generate_valid_moves(board, bot_cones, 2)

        # Order moves for better pruning (capture moves first, then center)
        moves.sort(key=lambda m: self.move_ordering_score(board, m), reverse=True)

        for move in moves:
            r, c, size = move['row'], move['col'], move['cone_size']

            # Simulate
            original = board[r][c]
            board[r][c] = {"player": 2, "size": size}
            new_bot_cones = bot_cones.copy()
            if new_bot_cones[size] < 900:
                new_bot_cones[size] -= 1

            # Score
            score = self.minimax(board, new_bot_cones, player_cones, search_depth - 1, False, alpha, beta)

            # Undo
            board[r][c] = original

            if score > best_score:
                best_score = score
                best_move = move

            alpha = max(alpha, score)
            if beta <= alpha:
                break

        return best_move

    def minimax(self, board, bot_cones, player_cones, depth, is_maximizing, alpha, beta):
        # Terminal checks
        if self.strategy.check_win(board, 2):
            return 10000 + depth # Prefer faster win
        if self.strategy.check_win(board, 1):
            return -10000 - depth # Prefer slower loss

        if depth == 0:
            return self.strategy.evaluate_board(board, 2, bot_cones, player_cones)

        if is_maximizing:
            max_eval = float('-inf')
            moves = self.strategy.generate_valid_moves(board, bot_cones, 2)

            if not moves:
                return 0

            # Order moves
            moves.sort(key=lambda m: self.move_ordering_score(board, m), reverse=True)

            for move in moves:
                r, c, size = move['row'], move['col'], move['cone_size']
                original = board[r][c]
                board[r][c] = {"player": 2, "size": size}
                new_bot_cones = bot_cones.copy()
                if new_bot_cones[size] < 900:
                    new_bot_cones[size] -= 1

                eval = self.minimax(board, new_bot_cones, player_cones, depth - 1, False, alpha, beta)

                board[r][c] = original
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float('inf')
            moves = self.strategy.generate_valid_moves(board, player_cones, 1)

            if not moves:
                return 0

            # Order moves
            moves.sort(key=lambda m: self.move_ordering_score(board, m), reverse=True)

            for move in moves:
                r, c, size = move['row'], move['col'], move['cone_size']
                original = board[r][c]
                board[r][c] = {"player": 1, "size": size}
                new_player_cones = player_cones.copy()
                if new_player_cones[size] < 900:
                    new_player_cones[size] -= 1

                eval = self.minimax(board, bot_cones, new_player_cones, depth - 1, True, alpha, beta)

                board[r][c] = original
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            return min_eval

    def move_ordering_score(self, board, move):
        """Heuristic to order moves for pruning"""
        r, c, size = move['row'], move['col'], move['cone_size']
        score = 0

        # Capture/Overwrite is high priority
        if board[r][c] is not None:
            score += 100

        # Center is good
        if r == 1 and c == 1:
            score += 50

        # Larger cones are generally stronger moves (harder to overwrite)
        score += size * 10

        return score
