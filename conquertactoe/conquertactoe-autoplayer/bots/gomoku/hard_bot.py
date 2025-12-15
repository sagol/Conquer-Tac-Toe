import random
import time
from typing import Dict, Any, Optional, List
from core.bot_interface import IBot
from .gomoku_strategy import GomokuStrategy

# Pre-compute Zobrist table for fast board hashing
# Supports up to 19x19 boards with 2 players

class ZobristHasher:
    """Fast incremental board hashing using Zobrist method"""

    def __init__(self, max_board_size: int = 19):
        self.max_size = max_board_size
        # Generate random 64-bit numbers for each (row, col, player) combination
        random.seed(42)  # Fixed seed for reproducibility
        self.table = {}
        for r in range(max_board_size):
            for c in range(max_board_size):
                for player in [1, 2]:
                    self.table[(r, c, player)] = random.getrandbits(64)
        random.seed()  # Reset to system seed

    def compute_hash(self, board: List[List[Optional[Dict]]], board_size: int) -> int:
        """Compute full board hash"""
        h = 0
        for r in range(min(board_size, len(board))):
            for c in range(min(board_size, len(board[r]) if r < len(board) else 0)):
                cell = board[r][c]
                if cell:
                    h ^= self.table[(r, c, cell['player'])]
        return h

    def update_hash(self, current_hash: int, r: int, c: int, player: int, adding: bool) -> int:
        """Incrementally update hash when placing/removing a piece"""
        # XOR is its own inverse, so adding and removing use same operation
        return current_hash ^ self.table[(r, c, player)]


class GomokuHardBot(IBot):
    """
    Hard Gomoku bot (Expert) - Optimized Version:
    - Iterative Deepening with aspiration windows
    - Zobrist hashing for O(1) transposition lookups
    - Persistent transposition table (not cleared between moves)
    - Deep VCF (Victory by Continuous Forcing)
    - Advanced move ordering with killer heuristic
    - No randomness (plays best move)
    """

    def __init__(self):
        self.strategy = GomokuStrategy()
        self.max_time = 4.5  # Leave margin for response
        self.zobrist = ZobristHasher()
        # Persistent across moves - LRU-like with size limit
        self.transposition_table = {}
        self.tt_max_size = 100000
        self.killer_moves = {}
        self.history_table = {}  # Move history heuristic
        self.nodes_searched = 0

    @property
    def name(self) -> str:
        return "Gomoku Hard Bot (Expert - Optimized)"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        board = game_state.get("board")
        if not board:
            return None

        board_size = len(board)
        player = 2

        # Reset per-move state
        self.killer_moves.clear()
        self.nodes_searched = 0

        # Trim transposition table if too large
        if len(self.transposition_table) > self.tt_max_size:
            # Keep most recent entries (simple approach)
            self.transposition_table = dict(list(self.transposition_table.items())[-self.tt_max_size//2:])

        # 1. Opening Move (Optimal)
        opening_move = self.strategy.get_opening_move(board, player, board_size)
        if opening_move:
            return opening_move

        # 2. Check for immediate winning move
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        for r, c in candidates:
            board[r][c] = {"player": player, "size": 0}
            if self.strategy.check_win(board, player, board_size):
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}
            board[r][c] = None

        # 3. Check for must-block moves (opponent wins next move)
        opponent = 1
        for r, c in candidates:
            board[r][c] = {"player": opponent, "size": 0}
            if self.strategy.check_win(board, opponent, board_size):
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}
            board[r][c] = None

        # 4. VCF Search (Deep) - Look for forced win sequence
        vcf_move = self.find_vcf_sequence(board, player, board_size, max_depth=14)
        if vcf_move:
            return vcf_move

        # 5. Iterative Deepening Search
        best_move = self.iterative_deepening_search(board, player, board_size)
        return best_move

    def iterative_deepening_search(self, board, player, board_size):
        """Iterative deepening with time management"""
        start_time = time.time()

        candidates = self.strategy.generate_candidate_moves(board, board_size)
        if not candidates:
            return None

        # Initial move ordering using quick heuristic
        scored_moves = self.score_moves_for_ordering(board, player, board_size, candidates)
        ordered_moves = [m[0] for m in scored_moves[:25]]  # Top 25 candidates

        if not ordered_moves:
            return None

        # Get the top move and its score
        top_move = ordered_moves[0]
        top_score = scored_moves[0][1]

        # CRITICAL: If top move is a significant play (blocks/creates threat), use it
        # Threshold catches: wins, blocks, fours, open threes
        if top_score >= 2000:
            return {"row": top_move[0], "col": top_move[1], "cone_size": 0}

        best_move = top_move
        best_score = float('-inf')

        # Start with depth 2, increase until time runs out
        for depth in range(2, 16):  # Deeper search for Hard
            if time.time() - start_time > self.max_time * 0.8:
                break

            move, score = self.search_at_depth(
                board, player, board_size, ordered_moves, depth, start_time
            )

            if move and (time.time() - start_time <= self.max_time):
                best_move = move
                best_score = score

                # Re-order moves based on this iteration's results
                # (PV move goes first)
                if move in ordered_moves:
                    ordered_moves.remove(move)
                    ordered_moves.insert(0, move)

            # Early exit if we found a winning move
            if best_score > 50000:
                break

        if best_move:
            return {"row": best_move[0], "col": best_move[1], "cone_size": 0}
        return None

    def search_at_depth(self, board, player, board_size, candidates, depth, start_time):
        """Search at a specific depth"""
        best_score = float('-inf')
        best_move = None
        alpha = float('-inf')
        beta = float('inf')

        board_hash = self.zobrist.compute_hash(board, board_size)

        for r, c in candidates:
            if time.time() - start_time > self.max_time:
                break

            # Make move
            board[r][c] = {"player": player, "size": 0}
            new_hash = self.zobrist.update_hash(board_hash, r, c, player, True)

            score = -self.negamax(
                board, new_hash, depth - 1, -beta, -alpha,
                1, player, board_size, start_time, 1
            )

            # Unmake move
            board[r][c] = None

            if score > best_score:
                best_score = score
                best_move = (r, c)

            alpha = max(alpha, score)
            if alpha >= beta:
                break

        return best_move, best_score

    def negamax(self, board, board_hash, depth, alpha, beta, color, bot_player, board_size, start_time, ply):
        """Negamax with alpha-beta pruning and transposition table"""
        self.nodes_searched += 1

        if time.time() - start_time > self.max_time:
            return color * self.evaluate_position(board, bot_player, board_size)

        # Transposition table lookup
        tt_entry = self.transposition_table.get(board_hash)
        if tt_entry and tt_entry['depth'] >= depth:
            if tt_entry['flag'] == 'exact':
                return tt_entry['score']
            elif tt_entry['flag'] == 'lower' and tt_entry['score'] > alpha:
                alpha = tt_entry['score']
            elif tt_entry['flag'] == 'upper' and tt_entry['score'] < beta:
                beta = tt_entry['score']
            if alpha >= beta:
                return tt_entry['score']

        current_player = bot_player if color == 1 else (1 if bot_player == 2 else 2)
        opponent = 1 if current_player == 2 else 2

        # Check for win (previous move won)
        if self.strategy.check_win(board, opponent, board_size):
            return -100000 - depth

        if depth == 0:
            score = color * self.evaluate_position(board, bot_player, board_size)
            self.transposition_table[board_hash] = {
                'score': score, 'depth': depth, 'flag': 'exact'
            }
            return score

        # Get ordered moves
        candidates = self.get_ordered_moves(board, current_player, board_size, ply, board_hash)

        if not candidates:
            return 0  # Draw

        best_score = float('-inf')
        flag = 'upper'

        for r, c in candidates[:15]:  # Limit branching factor
            # Make move
            board[r][c] = {"player": current_player, "size": 0}
            new_hash = self.zobrist.update_hash(board_hash, r, c, current_player, True)

            score = -self.negamax(
                board, new_hash, depth - 1, -beta, -alpha,
                -color, bot_player, board_size, start_time, ply + 1
            )

            # Unmake move
            board[r][c] = None

            if score > best_score:
                best_score = score
                if score > alpha:
                    alpha = score
                    flag = 'exact'
                    # Update killer moves
                    if ply not in self.killer_moves:
                        self.killer_moves[ply] = []
                    if (r, c) not in self.killer_moves[ply]:
                        self.killer_moves[ply].insert(0, (r, c))
                        if len(self.killer_moves[ply]) > 2:
                            self.killer_moves[ply].pop()

            if alpha >= beta:
                flag = 'lower'
                # Update history heuristic
                key = (r, c)
                self.history_table[key] = self.history_table.get(key, 0) + depth * depth
                break

        # Store in transposition table
        self.transposition_table[board_hash] = {
            'score': best_score, 'depth': depth, 'flag': flag
        }

        return best_score

    def score_moves_for_ordering(self, board, player, board_size, candidates):
        """Quick heuristic scoring for initial move ordering"""
        scored = []
        opponent = 1 if player == 2 else 2

        for r, c in candidates:
            score = 0

            # Center preference (minor)
            center = board_size // 2
            dist = abs(r - center) + abs(c - center)
            score += max(0, 10 - dist)

            # History heuristic
            score += self.history_table.get((r, c), 0) // 100

            # === CRITICAL: Check win/threat for this move ===
            board[r][c] = {"player": player, "size": 0}

            # Immediate win - highest priority
            if self.strategy.check_win(board, player, board_size):
                score += 1000000  # Guaranteed win

            # Evaluate threat value of this move (OFFENSE)
            eval_score = self.strategy.evaluate_board(board, player, board_size)
            offense_bonus = 0
            if eval_score > 50000:  # Creates four or better
                offense_bonus = 50000
            elif eval_score > 2000:  # Creates open three
                offense_bonus = 5000
            score += offense_bonus

            board[r][c] = None

            # === DEFENSE IS MORE IMPORTANT THAN OFFENSE ===
            board[r][c] = {"player": opponent, "size": 0}

            # Block opponent's immediate win - critical!
            if self.strategy.check_win(board, opponent, board_size):
                score += 500000  # Must block

            # Evaluate opponent threat value (DEFENSE > OFFENSE)
            opp_eval = self.strategy.evaluate_board(board, opponent, board_size)
            defense_bonus = 0
            if opp_eval > 50000:  # Blocks opponent's four
                defense_bonus = 100000
            elif opp_eval > 2000:  # Blocks opponent's three
                defense_bonus = 60000
            score += defense_bonus

            board[r][c] = None

            # === COMBINATION BONUS: moves that block AND attack are strongest ===
            if offense_bonus >= 5000 and defense_bonus >= 60000:
                score += 25000  # Strong combo: blocks threat + builds own threat
            elif offense_bonus >= 2000 and defense_bonus >= 10000:
                score += 10000  # Moderate combo

            scored.append(((r, c), score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    def get_ordered_moves(self, board, player, board_size, ply, board_hash=None):
        """Get moves ordered by killer heuristic and history table"""
        candidates = self.strategy.generate_candidate_moves(board, board_size)

        # Score all candidates
        scored_candidates = []
        for move in candidates:
            r, c = move
            score = 0

            # Killer moves get high priority
            if ply in self.killer_moves and move in self.killer_moves[ply]:
                score += 10000

            # History heuristic
            score += self.history_table.get(move, 0)

            # Center preference
            center = board_size // 2
            dist = abs(r - center) + abs(c - center)
            score += max(0, 5 - dist)

            scored_candidates.append((move, score))

        scored_candidates.sort(key=lambda x: x[1], reverse=True)
        return [m[0] for m in scored_candidates]

    def evaluate_position(self, board, player, board_size):
        """Evaluate board position"""
        score = self.strategy.evaluate_board(board, player, board_size)
        score += self.evaluate_zone_control(board, player, board_size)
        return score

    def evaluate_zone_control(self, board, player, board_size):
        """Evaluate control of key board zones"""
        score = 0
        center = board_size // 2

        for r in range(max(0, center-2), min(board_size, center+3)):
            for c in range(max(0, center-2), min(board_size, center+3)):
                if r < len(board) and c < len(board[r]) and board[r][c]:
                    if board[r][c]['player'] == player:
                        distance_from_center = abs(r - center) + abs(c - center)
                        score += (5 - distance_from_center) * 2

        return score

    def find_vcf_sequence(self, board, player, board_size, depth=0, max_depth=10):
        """Deep VCF search - look for forced win sequences"""
        if depth >= max_depth:
            return None

        opponent = 1 if player == 2 else 2
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
            if score > 8000:  # Creates 4 or better
                forcing_moves.append((r, c, score))

            board[r][c] = None

        # Sort by score and try top forcing moves
        forcing_moves.sort(key=lambda x: x[2], reverse=True)

        for r, c, _ in forcing_moves[:5]:
            board[r][c] = {"player": player, "size": 0}

            # Find opponent's forced response (must block our threat)
            opp_response = self.find_forced_response(board, opponent, player, board_size)

            if opp_response:
                # Play opponent's response
                or_, oc = opp_response
                board[or_][oc] = {"player": opponent, "size": 0}

                # Continue the attack
                next_move = self.find_vcf_sequence(board, player, board_size, depth + 1, max_depth)

                board[or_][oc] = None
                board[r][c] = None

                if next_move:
                    return {"row": r, "col": c, "cone_size": 0}
            else:
                # No forced response means we might have multiple threats
                board[r][c] = None
                # This could be a winning position

        return None

    def find_forced_response(self, board, player, attacker, board_size):
        """Find if there's exactly one move that blocks a four"""
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        blocking_moves = []

        for r, c in candidates:
            board[r][c] = {"player": player, "size": 0}
            # Check if this blocks the threat
            attacker_score = self.strategy.evaluate_board(board, attacker, board_size)
            if attacker_score < 5000:  # Threat blocked
                blocking_moves.append((r, c))
            board[r][c] = None

        # Return the blocking move if there's exactly one
        if len(blocking_moves) == 1:
            return blocking_moves[0]
        return None
