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
            # Improved: Keep entries with highest depth (most valuable)
            # Sort by depth and keep top half
            sorted_entries = sorted(
                self.transposition_table.items(),
                key=lambda x: x[1].get('depth', 0),
                reverse=True
            )
            self.transposition_table = dict(sorted_entries[:self.tt_max_size//2])

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

        # 3.3 CRITICAL: Block 3-in-a-row extensions (before they become 4)
        # BUT: Only if opponent has a SINGLE 3-in-a-row (if multiple, skip to attack)
        three_extension_block = self.find_three_extension_block(board, opponent, board_size, candidates)
        if three_extension_block:
            return three_extension_block

        # 3.5 CRITICAL: Check for 4-in-a-row threats (one move from winning)
        four_in_row_block = self.find_four_in_row_threat(board, opponent, board_size, candidates)
        if four_in_row_block:
            return four_in_row_block

        # 4. CRITICAL: Block opponent's existing fork (especially with 4-in-a-row!)
        # This must come BEFORE creating own fork to prevent opponent wins
        opponent_fork = self.find_fork_move(board, opponent, board_size, candidates)
        if opponent_fork:
            return opponent_fork

        # 4.5 OFFENSIVE: Create our own fork (after blocking critical threats)
        # Still aggressive, but only after ensuring opponent can't win next move
        fork_move = self.find_fork_move(board, player, board_size, candidates)
        if fork_move:
            return fork_move
        
        # 4.7 LOWER PRIORITY: Prevent future forks (after offensive plays)
        preventive_block = self.find_preventive_fork_block(board, opponent, board_size, candidates)
        if preventive_block:
            return preventive_block

        # 5. VCF Search (Deep) - Look for forced win sequence
        # Enhanced with lower threshold and greater depth
        vcf_move = self.find_vcf_sequence(board, player, board_size, max_depth=20)
        if vcf_move:
            return vcf_move

        # 6. Iterative Deepening Search
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
        # Lowered from 2000 to 1500 for better tactical awareness
        if top_score >= 1500:
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
                score += 150000  # Massively increased - combo moves are strategic wins
            elif offense_bonus >= 2000 and defense_bonus >= 10000:
                score += 75000  # Moderate combo also very valuable

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
        """
        Enhanced VCF - Victory by Continuous Forcing.
        Finds moves that create unstoppable forcing sequences.
        """
        if depth >= max_depth:
            return None

        opponent = 1 if player == 2 else 2
        candidates = self.strategy.generate_candidate_moves(board, board_size)

        # Collect forcing moves with threat analysis
        forcing_moves = []
        
        for r, c in candidates:
            board[r][c] = {"player": player, "size": 0}

            # Immediate win
            if self.strategy.check_win(board, player, board_size):
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}

            # Analyze threats this move creates
            threats = self.count_threats(board, player, board_size, r, c)
            
            # Forcing criteria: creates 4-in-a-row or double 3-in-a-row
            is_forcing = threats['fours'] >= 1 or threats['threes'] >= 2
            
            if is_forcing:
                forcing_moves.append((r, c, threats['fours'] * 100 + threats['threes']))

            board[r][c] = None

        # Try forcing moves (strongest first)
        forcing_moves.sort(key=lambda x: x[2], reverse=True)

        for r, c, score in forcing_moves[:3]:  # Top 3 forcing moves
            board[r][c] = {"player": player, "size": 0}
            
            # After we play, what are opponent's options?
            # If they MUST block our four, verify we still win
            must_block = self.find_critical_blocks(board, player, opponent, board_size)
            
            if len(must_block) <= 2:  # Limited blocking options
                # Try each possible block
                wins_all_blocks = True
                for br, bc in must_block:
                    board[br][bc] = {"player": opponent, "size": 0}
                    
                    # Do we still have a win after they block?
                    next_forcing = self.find_vcf_sequence(
                        board, player, board_size, depth + 1, max_depth
                    )
                    
                    board[br][bc] = None
                    
                    if not next_forcing:
                        wins_all_blocks = False
                        break
                
                board[r][c] = None
                
                if wins_all_blocks and len(must_block) > 0:
                    return {"row": r, "col": c, "cone_size": 0}
            else:
                board[r][c] = None

        return None

    def find_critical_blocks(self, board, attacker, defender, board_size):
        """
        Find cells where defender MUST play to block attacker's threats.
        Returns list of critical blocking positions.
        """
        critical_blocks = []
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        
        for r, c in candidates:
            # Test if attacker playing here would create a four
            board[r][c] = {"player": attacker, "size": 0}
            threats_if_attacker_plays = self.count_threats(board, attacker, board_size, r, c)
            board[r][c] = None
            
            # This is a critical block if attacker would create a four here
            if threats_if_attacker_plays['fours'] >= 1:
                critical_blocks.append((r, c))
        
        return critical_blocks

    def find_preventive_fork_block(self, board, opponent, board_size, candidates):
        """
        PREVENTIVE: Find positions where if opponent plays, they would create a fork.
        This blocks fork threats BEFORE they happen.
        """
        dangerous_positions = []
        
        for r, c in candidates:
            # Simulate opponent playing here
            board[r][c] = {"player": opponent, "size": 0}
            
            # Would this create a fork for opponent?
            threats = self.count_threats(board, opponent, board_size, r, c)
            
            # A fork is when one move creates multiple threats
            # Either: 2+ threes, OR 1 four + 1 three, OR 2+ fours
            is_fork = (
                threats['threes'] >= 2 or
                (threats['fours'] >= 1 and threats['threes'] >= 1) or
                threats['fours'] >= 2
            )
            
            if is_fork:
                dangerous_positions.append((r, c, threats['fours'] * 100 + threats['threes']))
            
            board[r][c] = None
        
        # Block the most dangerous fork position
        if dangerous_positions:
            dangerous_positions.sort(key=lambda x: x[2], reverse=True)
            r, c, score = dangerous_positions[0]
            return {"row": r, "col": c, "cone_size": 0}
        
        return None

    def find_three_extension_block(self, board, opponent, board_size, candidates):
        """
        CRITICAL: Block positions that extend opponent's 3-in-a-row to 4-in-a-row.
        
        ENHANCEMENT 1: Detects if opponent has MULTIPLE 3-in-a-rows (fork).
        If opponent has 2+ different 3-in-a-rows, blocking one is useless - 
        we need to attack instead. Returns None in this case.
        
        ENHANCEMENT 2: Checks if threat is actually "open" (both ends extendable).
        Don't waste moves blocking threats that are already blocked from one side.
        """
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]  # H, V, diag-right, diag-left
        dangerous_extensions = []  # List of (row, col, direction_index, num_open_ends)
        
        for r, c in candidates:
            # Check if playing here extends opponent's line to 4
            board[r][c] = {"player": opponent, "size": 0}
            
            for dir_idx, (dr, dc) in enumerate(directions):
                # Count consecutive opponent pieces through this position
                total_consecutive = 1  # The piece we just placed
                
                # Count backward and check if end is blocked
                backward_blocked = False
                for i in range(1, 5):
                    nr, nc = r - dr * i, c - dc * i
                    if 0 <= nr < board_size and 0 <= nc < board_size:
                        cell = board[nr][nc]
                        if cell and cell.get('player') == opponent:
                            total_consecutive += 1
                        else:
                            # Hit a wall or opponent piece - check if blocked
                            if cell is not None and cell.get('player') != opponent:
                                backward_blocked = True
                            break
                    else:
                        backward_blocked = True  # Hit board edge
                        break
                
                # Count forward and check if end is blocked
                forward_blocked = False
                for i in range(1, 5):
                    nr, nc = r + dr * i, c + dc * i
                    if 0 <= nr < board_size and 0 <= nc < board_size:
                        cell = board[nr][nc]
                        if cell and cell.get('player') == opponent:
                            total_consecutive += 1
                        else:
                            # Hit a wall or opponent piece
                            if cell is not None and cell.get('player') != opponent:
                                forward_blocked = True
                            break
                    else:
                        forward_blocked = True  # Hit board edge
                        break
                
                # Calculate open ends (0, 1, or 2)
                num_open_ends = 2 - (1 if backward_blocked else 0) - (1 if forward_blocked else 0)
                
                # If this creates 4 consecutive AND has at least one open end
                if total_consecutive >= 4 and num_open_ends > 0:
                    dangerous_extensions.append((r, c, dir_idx, num_open_ends))
            
            board[r][c] = None
        
        if not dangerous_extensions:
            return None
        
        # Sort by open ends (prefer blocking fully open threats = 2 open ends)
        dangerous_extensions.sort(key=lambda x: x[3], reverse=True)
        
        # GROUP by direction to find if there are multiple independent 3-in-a-rows
        unique_directions = set(ext[2] for ext in dangerous_extensions)
        
        # If there are extensions in 2+ different directions, it's a fork  
        # (opponent has multiple 3-in-a-rows we can't block all)
        if len(unique_directions) >= 2:
            # FORK DETECTED: Opponent has 2+ different 3-in-a-rows
            # Defensive blocking won't work - return None to let bot attack
            return None
        
        # Block the most dangerous threat (most open ends first)
        r, c, _, _ = dangerous_extensions[0]
        return {"row": r, "col": c, "cone_size": 0}

    def find_fork_move(self, board, player, board_size, candidates):
        """
        ADVANCED: Find moves that create multiple threats simultaneously.
        Four-Three Fork: Creates a four AND an open three = guaranteed win
        Double-Three: Creates two open threes = almost guaranteed win
        """
        best_fork = None
        best_fork_score = 0
        
        for r, c in candidates:
            board[r][c] = {"player": player, "size": 0}
            
            # Count distinct threats created by this move
            threat_count = self.count_threats(board, player, board_size, r, c)
            
            # Four-three fork (has four + has three) or double-four = immediate win
            if threat_count['fours'] >= 1 and threat_count['threes'] >= 1:
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}  # Guaranteed win!
            
            # Double four = immediate win
            if threat_count['fours'] >= 2:
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}
            
            # Double three = very strong (opponent can only block one)
            if threat_count['threes'] >= 2:
                if threat_count['threes'] > best_fork_score:
                    best_fork_score = threat_count['threes']
                    best_fork = (r, c)
            
            board[r][c] = None
        
        if best_fork:
            return {"row": best_fork[0], "col": best_fork[1], "cone_size": 0}
        return None

    def count_threats(self, board, player, board_size, placed_r, placed_c):
        """
        Count distinct threat patterns created by the stone at (placed_r, placed_c).
        Returns dict with 'fours' and 'threes' counts.
        
        ENHANCED: Now detects gap-fours (XX_XX), broken-fours (X_XXX), 
        and secondary threats within radius.
        """
        threats = {'fours': 0, 'threes': 0}
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]  # horizontal, vertical, diagonals
        
        for dr, dc in directions:
            # Extract 9-cell line centered on placed stone
            line = []
            positions = []
            
            for i in range(-4, 5):
                nr, nc = placed_r + dr * i, placed_c + dc * i
                if 0 <= nr < board_size and 0 <= nc < board_size:
                    cell = board[nr][nc]
                    if cell and cell.get('player') == player:
                        line.append('X')
                    elif cell is None:
                        line.append('_')
                    else:
                        line.append('O')
                    positions.append((nr, nc))
                else:
                    line.append('#')  # Out of bounds
                    positions.append(None)
            
            line_str = ''.join(line)
            
            # Detect FOURS (immediate threats)
            four_patterns = [
                'XXXX_', '_XXXX',  # Simple four
                'XX_XX', 'X_XXX', 'XXX_X',  # Gap-fours
            ]
            
            for pattern in four_patterns:
                if pattern in line_str:
                    threats['fours'] += 1
                    break  # Count once per direction
            
            # Detect THREES (strong threats needing one more move)
            three_patterns = [
                '_XXX_',  # Open three (strongest)
                '__XXX_', '_XXX__',  # Semi-open three
                '_XX_X_', '_X_XX_',  # Broken three with space
            ]
            
            for pattern in three_patterns:
                if pattern in line_str:
                    threats['threes'] += 1
                    break  # Count once per direction
        
        return threats

    def find_four_in_row_threat(self, board, opponent, board_size, candidates):
        """
        Explicitly check for 4-in-a-row threats in ANY direction.
        Returns the blocking move if found.
        
        This is critical for catching diagonal threats that pattern
        evaluation might underweight.
        """
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]  # H, V, diag-right, diag-left
        
        # Check each empty cell to see if blocking it prevents a 4-in-row
        for r, c in candidates:
            for dr, dc in directions:
                # Count consecutive opponent pieces in this direction
                count = 0
                positions = []
                
                # Check positive direction
                for i in range(1, 5):
                    nr, nc = r + dr * i, c + dc * i
                    if 0 <= nr < board_size and 0 <= nc < board_size:
                        cell = board[nr][nc]
                        if cell and cell.get('player') == opponent:
                            count += 1
                            positions.append((nr, nc))
                        else:
                            break
                    else:
                        break
                
                # Check negative direction
                for i in range(1, 5):
                    nr, nc = r - dr * i, c - dc * i
                    if 0 <= nr < board_size and 0 <= nc < board_size:
                        cell = board[nr][nc]
                        if cell and cell.get('player') == opponent:
                            count += 1
                            positions.append((nr, nc))
                        else:
                            break
                    else:
                        break
                
                # If 4 or more consecutive opponent pieces, BLOCK!
                if count >= 4:
                    return {"row": r, "col": c, "cone_size": 0}
        
        return None
