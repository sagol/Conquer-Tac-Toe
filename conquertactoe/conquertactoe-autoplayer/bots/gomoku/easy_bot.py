import random
import time
from typing import Dict, Any, Optional
from core.bot_interface import IBot
from .gomoku_strategy import GomokuStrategy

class GomokuEasyBot(IBot):
    """
    Easy Gomoku bot:
    - Uses shared GomokuStrategy
    - Shallow search (Depth 2)
    - No VCF
    - Adds randomness to simulate mistakes
    """

    def __init__(self):
        self.strategy = GomokuStrategy()
        self.max_depth = 2
        self.max_time = 2.0
        self.randomness = 0.2  # 20% chance to pick suboptimal move from top 5

    @property
    def name(self) -> str:
        return "Easy Gomoku Bot"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        board = game_state.get("board")
        if not board:
            return None

        board_size = len(board)
        player = 2  # Bot is always player 2

        # 1. Opening Move
        opening_move = self.strategy.get_opening_move(board, player, board_size)
        if opening_move:
            # Add some randomness to opening for easy bot
            if random.random() < 0.3:
                # Play slightly off-center
                r, c = opening_move['row'], opening_move['col']
                offsets = [(0,1), (1,0), (0,-1), (-1,0)]
                dr, dc = random.choice(offsets)
                nr, nc = r + dr, c + dc
                if 0 <= nr < board_size and 0 <= nc < board_size:
                    return {"row": nr, "col": nc, "cone_size": 0}
            return opening_move

        # 2. Check for immediate win
        if self.strategy.check_win(board, player, board_size):
            # Should not happen if game logic is correct, but good safety
            pass

        # 3. Minimax Search
        best_move = self.minimax_search(board, player, board_size)
        return best_move

    def minimax_search(self, board, player, board_size):
        start_time = time.time()

        # Generate candidates
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        if not candidates:
            return None

        # Score moves - evaluate both our threats and opponent's
        scored_moves = []
        opponent = 1 if player == 2 else 2

        for r, c in candidates:
            score = 0

            # Check our move value
            board[r][c] = {"player": player, "size": 0}
            if self.strategy.check_win(board, player, board_size):
                score += 1000000  # Immediate win
            eval_score = self.strategy.evaluate_board(board, player, board_size)
            if eval_score > 50000:
                score += 50000  # Creates four
            elif eval_score > 2000:
                score += 2000  # Creates three
            board[r][c] = None

            # Check if blocks opponent threat
            board[r][c] = {"player": opponent, "size": 0}
            if self.strategy.check_win(board, opponent, board_size):
                score += 500000  # Must block
            opp_eval = self.strategy.evaluate_board(board, opponent, board_size)
            if opp_eval > 50000:
                score += 40000  # Blocks four
            elif opp_eval > 2000:
                score += 1500  # Blocks three
            board[r][c] = None

            scored_moves.append(((r, c), score))

        # Sort and take top 20 to search
        scored_moves.sort(key=lambda x: x[1], reverse=True)
        top_moves = [m[0] for m in scored_moves[:20]]

        best_score = float('-inf')
        best_moves = []
        alpha = float('-inf')
        beta = float('inf')

        for r, c in top_moves:
            if time.time() - start_time > self.max_time:
                break

            board[r][c] = {"player": player, "size": 0}
            score = self.minimax(board, self.max_depth - 1, False, alpha, beta, player, board_size, start_time)
            board[r][c] = None

            if score > best_score:
                best_score = score
                best_moves = [(r, c)]
            elif score == best_score:
                best_moves.append((r, c))

            alpha = max(alpha, score)

        if best_moves:
            # Easy bot randomness: pick from top moves or sometimes a random valid move
            if random.random() < self.randomness and len(top_moves) > 1:
                # Pick a random move from the top 5 candidates (suboptimal but not terrible)
                choice = random.choice(top_moves[:5])
                return {"row": choice[0], "col": choice[1], "cone_size": 0}

            # Otherwise pick one of the best moves
            choice = random.choice(best_moves)
            return {"row": choice[0], "col": choice[1], "cone_size": 0}

        return None

    def minimax(self, board, depth, is_maximizing, alpha, beta, bot_player, board_size, start_time):
        if depth == 0 or time.time() - start_time > self.max_time:
            return self.strategy.evaluate_board(board, bot_player, board_size)

        opponent = 1 if bot_player == 2 else 2
        current_player = bot_player if is_maximizing else opponent

        # Check for win
        if self.strategy.check_win(board, 1 if current_player == 2 else 2, board_size):
             # Previous move won
            return -100000 if is_maximizing else 100000

        candidates = self.strategy.generate_candidate_moves(board, board_size)

        if is_maximizing:
            max_eval = float('-inf')
            for r, c in candidates[:10]: # Limit branching
                board[r][c] = {"player": bot_player, "size": 0}
                eval = self.minimax(board, depth - 1, False, alpha, beta, bot_player, board_size, start_time)
                board[r][c] = None
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float('inf')
            for r, c in candidates[:10]:
                board[r][c] = {"player": opponent, "size": 0}
                eval = self.minimax(board, depth - 1, True, alpha, beta, bot_player, board_size, start_time)
                board[r][c] = None
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            return min_eval
