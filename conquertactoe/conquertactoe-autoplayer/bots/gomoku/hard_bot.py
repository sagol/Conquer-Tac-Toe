import random
import time
from typing import Dict, Any, Optional, List, Tuple
from core.bot_interface import IBot

class GomokuHardBot(IBot):
    """Hard difficulty Gomoku bot with threat-space search - Expert level"""
    
    def __init__(self):
        self.max_depth = 16  # Very deep search for expert play
        self.max_time = 5.0  # Maximum time for best moves
        self.randomness = 0.02  # 2% chance of slight variation (minimal)
        # Professional-level pattern weights
        self.pattern_weights = {
            'five': 1000000,
            'open_four': 50000,
            'four': 5000,
            'open_three': 1000,
            'broken_three': 200,
            'three': 50,
            'open_two': 10,
            'two': 5
        }
        self.transposition_table = {}
        self.killer_moves = {}  # Killer move heuristic
        
    @property
    def name(self) -> str:
        return "Gomoku Hard Bot (Expert)"
    
    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Expert-level Gomoku with threat-space search and deep tactical analysis"""
        board = game_state.get("board")
        player = 2
        
        if not board:
            return None

        actual_board_size = len(board)
        opponent = 1 if player == 2 else 2
        
        # Opening move: play center
        piece_count = sum(1 for r in range(actual_board_size) for c in range(actual_board_size)
                         if r < len(board) and c < len(board[r]) and board[r][c] is not None)
        if piece_count == 0:
            center = actual_board_size // 2
            return {"row": center, "col": center, "cone_size": 0}
        elif piece_count == 1:
            center = actual_board_size // 2
            offsets = [(0,1), (1,0), (1,1), (-1,1)]
            offset = random.choice(offsets)
            return {"row": center + offset[0], "col": center + offset[1], "cone_size": 0}
        
        
        # Priority 1: Immediate win
        winning_move = self.find_winning_move(board, player, actual_board_size)
        if winning_move:
            return winning_move
        
        # Priority 2: Block opponent's open four (unstoppable)
        block_open_four = self.find_open_four(board, opponent, actual_board_size)
        if block_open_four:
            return block_open_four
        
        # Priority 3: Create our open four (unstoppable win)
        create_open_four = self.find_open_four(board, player, actual_board_size)
        if create_open_four:
            return create_open_four
        
        # Priority 4: Threat-space search (forced win sequences)
        threat_move = self.threat_space_search(board, player, actual_board_size)
        if threat_move:
            return threat_move
        
        # Add tiny randomness: 5% chance for variety (prevents perfect determinism)
        if random.random() < self.randomness:
            # Still play strategically, just not the absolute best move
            return self.strategic_move(board, player, actual_board_size)
        
        # Priority 5: Deep minimax with killer move heuristic  
        minimax_move = self.deep_minimax_search(board, player, actual_board_size)
        if minimax_move:
            return minimax_move
        
        # Fallback to pattern-based strategic move
        return self.strategic_move(board, player, actual_board_size)
    
    def threat_space_search(self, board, player, board_size, depth=0, max_depth=5):
        """
        Threat-space search: Find forced winning sequences
        This is more powerful than regular minimax for Gomoku
        """
        if depth >= max_depth:
            return None
        
        opponent = 1 if player == 2 else 2
        
        # Find all threat moves (moves that create multiple threats)
        threat_moves = self.find_double_threat_moves(board, player, board_size)
        
        for move_r, move_c, threat_count in threat_moves:
            # Make the threat move
            board[move_r][move_c] = {"player": player, "size": 0}
            
            # Find all defensive responses opponent must make
            defensive_moves = self.find_all_critical_defenses(board, opponent, board_size)
            
            # If opponent has only one defense, continue threat search
            if len(defensive_moves) == 1:
                def_r, def_c = defensive_moves[0]
                board[def_r][def_c] = {"player": opponent, "size": 0}
                
                # Recursively search for continuation
                next_threat = self.threat_space_search(board, player, board_size, depth + 1, max_depth)
                
                board[def_r][def_c] = None
                
                # If we found a forced win, return this move
                if next_threat or self.check_win_from_move(board, move_r, move_c, player, board_size):
                    board[move_r][move_c] = None
                    return {"row": move_r, "col": move_c, "cone_size": 0}
            
            # If opponent has no defense, we win
            elif len(defensive_moves) == 0:
                board[move_r][move_c] = None
                return {"row": move_r, "col": move_c, "cone_size": 0}
            
            board[move_r][move_c] = None
        
        return None
    
    def find_double_threat_moves(self, board, player, board_size) -> List[Tuple[int, int, int]]:
        """Find moves that create multiple simultaneous threats"""
        threat_moves = []
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                
                # Try this move
                board[r][c] = {"player": player, "size": 0}
                
                # Count how many threats it creates
                threat_count = self.count_threats_created(board, r, c, player, board_size)
                
                if threat_count >= 2:  # Double threat or better
                    threat_moves.append((r, c, threat_count))
                
                board[r][c] = None
        
        # Sort by threat count (higher is better)
        threat_moves.sort(key=lambda x: x[2], reverse=True)
        return threat_moves[:10]  # Top 10 threat moves
    
    def count_threats_created(self, board, r, c, player, board_size) -> int:
        """Count number of threats created by move at (r,c)"""
        threats = 0
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        
        for dr, dc in directions:
            count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
            
            # Open four = critical threat
            if count == 4 and self.is_line_open_both_ends(board, r, c, dr, dc, player, board_size):
                threats += 3
            # Four = significant threat
            elif count == 4:
                threats += 2
            # Open three = medium threat
            elif count == 3 and self.is_line_open_both_ends(board, r, c, dr, dc, player, board_size):
                threats += 1
        
        return threats
    
    def find_all_critical_defenses(self, board, player, board_size) -> List[Tuple[int, int]]:
        """Find all moves that defend against immediate critical threats"""
        defenses = []
        
        # Must block open-fours and fours
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                
                board[r][c] = {"player": player, "size": 0}
                
                # Check if this creates open-four or four
                directions = [(0,1), (1,0), (1,1), (1,-1)]
                is_critical = False
                
                for dr, dc in directions:
                    count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
                    if count >= 4:
                        is_critical = True
                        break
                
                if is_critical:
                    defenses.append((r, c))
                
                board[r][c] = None
        
        return defenses
    
    def deep_minimax_search(self, board, player, board_size):
        """Deep minimax with killer move heuristic and advanced pruning"""
        start_time = time.time()
        self.transposition_table.clear()
        self.killer_moves.clear()
        
        best_score = float('-inf')
        best_move = None
        alpha = float('-inf')
        beta = float('inf')
        
        # Get intelligently ordered moves
        moves = self.get_advanced_ordered_moves(board, player, board_size)
        
        for move in moves[:30]:  # Expand search width for hard difficulty
            if time.time() - start_time > self.max_time:
                break
            
            board[move[0]][move[1]] = {"player": player, "size": 0}
            score = self.minimax_with_killers(board, self.max_depth - 1, False, alpha, beta, 
                                              player, board_size, start_time, 0)
            board[move[0]][move[1]] = None
            
            if score > best_score:
                best_score = score
                best_move = move
            
            alpha = max(alpha, score)
            if beta <= alpha:
                break
        
        if best_move:
            return {"row": best_move[0], "col": best_move[1], "cone_size": 0}
        return None
    
    def minimax_with_killers(self, board, depth, is_maximizing, alpha, beta, bot_player, board_size, start_time, ply):
        """Minimax with killer move heuristic for better move ordering"""
        if time.time() - start_time > self.max_time:
            return 0
        
        # Transposition table lookup
        board_key = self.get_board_key(board, board_size)
        if board_key in self.transposition_table:
            return self.transposition_table[board_key]
        
        # Terminal checks
        winner = self.check_win_fast(board, board_size)
        if winner == bot_player:
            return 100000 + depth
        elif winner:
            return -100000 - depth
        
        if depth == 0:
            eval_score = self.advanced_evaluate_position(board, bot_player, board_size)
            self.transposition_table[board_key] = eval_score
            return eval_score
        
        # Get moves (prioritize killer moves)
        moves = self.get_moves_with_killers(board, bot_player if is_maximizing else (1 if bot_player == 2 else 2), board_size, ply)
        
        if is_maximizing:
            max_eval = float('-inf')
            for move in moves[:25]:
                if time.time() - start_time > self.max_time:
                    break
                board[move[0]][move[1]] = {"player": bot_player, "size": 0}
                eval_score = self.minimax_with_killers(board, depth - 1, False, alpha, beta, 
                                                       bot_player, board_size, start_time, ply + 1)
                board[move[0]][move[1]] = None
                
                if eval_score > max_eval:
                    max_eval = eval_score
                    # Store killer move
                    if ply not in self.killer_moves:
                        self.killer_moves[ply] = []
                    if move not in self.killer_moves[ply]:
                        self.killer_moves[ply].insert(0, move)
                        if len(self.killer_moves[ply]) > 2:
                            self.killer_moves[ply] = self.killer_moves[ply][:2]
                
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    break
            
            self.transposition_table[board_key] = max_eval
            return max_eval
        else:
            opponent = 1 if bot_player == 2 else 2
            min_eval = float('inf')
            for move in moves[:25]:
                if time.time() - start_time > self.max_time:
                    break
                board[move[0]][move[1]] = {"player": opponent, "size": 0}
                eval_score = self.minimax_with_killers(board, depth - 1, True, alpha, beta, 
                                                       bot_player, board_size, start_time, ply + 1)
                board[move[0]][move[1]] = None
                min_eval = min(min_eval, eval_score)
                beta = min(beta, eval_score)
                if beta <= alpha:
                    break
            
            self.transposition_table[board_key] = min_eval
            return min_eval
    
    def get_moves_with_killers(self, board, player, board_size, ply):
        """Get moves with killer moves prioritized"""
        moves = []
        killer_list = self.killer_moves.get(ply, [])
        
        # Add killer moves first (if valid)
        for kr, kc in killer_list:
            if 0 <= kr < board_size and 0 <= kc < board_size:
                if kr < len(board) and kc < len(board[kr]) and board[kr][kc] is None:
                    moves.append((kr, kc))
        
        # Add other moves  
        other_moves = self.get_advanced_ordered_moves(board, player, board_size)
        for move in other_moves:
            if move not in moves:
                moves.append(move)
        
        return moves
    
    def get_advanced_ordered_moves(self, board, player, board_size):
        """Advanced move ordering for expert play"""
        moves_with_scores = []
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                
                score = 0
                
                # Check if move creates immediate threats
                board[r][c] = {"player": player, "size": 0}
                threat_score = self.count_threats_created(board, r, c, player, board_size)
                score += threat_score * 1000
                board[r][c] = None
                
                # Add proximity score
                proximity = self.score_move_position(board, r, c, player, board_size)
                score += proximity
                
                if score > 0:
                    moves_with_scores.append(((r, c), score))
        
        moves_with_scores.sort(key=lambda x: x[1], reverse=True)
        return [move for move, score in moves_with_scores]
    
    def advanced_evaluate_position(self, board, player, board_size):
        """Advanced position evaluation with zone control"""
        opponent = 1 if player == 2 else 2
        score = 0
        
        # Pattern-based evaluation
        my_patterns = self.count_all_patterns(board, player, board_size)
        opp_patterns = self.count_all_patterns(board, opponent, board_size)
        
        for pattern_type, weight in self.pattern_weights.items():
            score += weight * (my_patterns.get(pattern_type, 0) - 1.2 * opp_patterns.get(pattern_type, 0))
        
        # Zone of influence (control of board areas)
        score += self.evaluate_zone_control(board, player, board_size)
        
        return score
    
    def evaluate_zone_control(self, board, player, board_size):
        """Evaluate control of key board zones"""
        score = 0
        center = board_size // 2
        
        # Center control is valuable
        for r in range(max(0, center-2), min(board_size, center+3)):
            for c in range(max(0, center-2), min(board_size, center+3)):
                if r < len(board) and c < len(board[r]) and board[r][c]:
                    if board[r][c]['player'] == player:
                        distance_from_center = abs(r - center) + abs(c - center)
                        score += (5 - distance_from_center) * 2
        
        return score
    
    # Helper methods (optimized versions from Easy/Medium bots)
    def count_all_patterns(self, board, player, board_size):
        """Count patterns"""
        patterns = {'five': 0, 'open_four': 0, 'four': 0, 'open_three': 0, 'broken_three': 0, 'three': 0, 'open_two': 0, 'two': 0}
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or not board[r][c] or board[r][c]['player'] != player:
                    continue
                for dr, dc in directions:
                    count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
                    if count >= 5:
                        patterns['five'] += 1
                    elif count == 4:
                        if self.is_line_open_both_ends(board, r, c, dr, dc, player, board_size):
                            patterns['open_four'] += 1
                        else:
                            patterns['four'] += 1
                    elif count == 3:
                        if self.is_line_open_both_ends(board, r, c, dr, dc, player, board_size):
                            patterns['open_three'] += 1
                        else:
                            patterns['three'] += 1
                    elif count == 2:
                        if self.is_line_open_both_ends(board, r, c, dr, dc, player, board_size):
                            patterns['open_two'] += 1
                        else:
                            patterns['two'] += 1
        return patterns
    
    def is_line_open_both_ends(self, board, r, c, dr, dc, player, board_size):
        """Check if line is open on both ends"""
        # Find extent of line
        start_r, start_c = r, c
        while True:
            new_r, new_c = start_r - dr, start_c - dc
            if (new_r < 0 or new_r >= board_size or new_c < 0 or new_c >= board_size or
                new_r >= len(board) or new_c >= len(board[new_r])):
                break
            if board[new_r][new_c] and board[new_r][new_c]['player'] == player:
                start_r, start_c = new_r, new_c
            else:
                break
        
        end_r, end_c = r, c
        while True:
            new_r, new_c = end_r + dr, end_c + dc
            if (new_r < 0 or new_r >= board_size or new_c < 0 or new_c >= board_size or
                new_r >= len(board) or new_c >= len(board[new_r])):
                break
            if board[new_r][new_c] and board[new_r][new_c]['player'] == player:
                end_r, end_c = new_r, new_c
            else:
                break
        
        # Check both ends
        before_r, before_c = start_r - dr, start_c - dc
        after_r, after_c = end_r + dr, end_c + dc
        
        before_open = (0 <= before_r < board_size and 0 <= before_c < board_size and
                      before_r < len(board) and before_c < len(board[before_r]) and
                      board[before_r][before_c] is None)
        after_open = (0 <= after_r < board_size and 0 <= after_c < board_size and
                     after_r < len(board) and after_c < len(board[after_r]) and
                     board[after_r][after_c] is None)
        
        return before_open and after_open
    
    def count_consecutive(self, board, r, c, dr, dc, player, board_size):
        """Count consecutive pieces in direction"""
        count = 1
        for i in range(1, 6):
            nr, nc = r + dr*i, c + dc*i
            if nr < 0 or nr >= board_size or nc < 0 or nc >= board_size:
                break
            if nr >= len(board) or nc >= len(board[nr]):
                break
            if board[nr][nc] and board[nr][nc]['player'] == player:
                count += 1
            else:
                break
        for i in range(1, 6):
            nr, nc = r - dr*i, c - dc*i
            if nr < 0 or nr >= board_size or nc < 0 or nc >= board_size:
                break
            if nr >= len(board) or nc >= len(board[nr]):
                break
            if board[nr][nc] and board[nr][nc]['player'] == player:
                count += 1
            else:
                break
        return count
    
    def get_board_key(self, board, board_size):
        """Create board key for transposition table"""
        key_list = []
        for r in range(min(board_size, len(board))):
            for c in range(min(board_size, len(board[r]) if r < len(board) else 0)):
                cell = board[r][c] if r < len(board) and c < len(board[r]) else None
                if cell:
                    key_list.append((r, c, cell['player']))
        return tuple(key_list)
    
    def score_move_position(self, board, r, c, player, board_size):
        """Score move based on proximity"""
        score = 0
        for dr in range(-2, 3):
            for dc in range(-2, 3):
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if 0 <= nr < board_size and 0 <= nc < board_size:
                    if nr < len(board) and nc < len(board[nr]):
                        if board[nr][nc] and board[nr][nc]['player'] == player:
                            distance = abs(dr) + abs(dc)
                            score += (5 - distance)
                        elif board[nr][nc]:
                            score += 2
        return score
    
    def find_winning_move(self, board, player, board_size):
        """Find immediate win"""
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                board[r][c] = {"player": player, "size": 0}
                if self.check_win_from_move(board, r, c, player, board_size):
                    board[r][c] = None
                    return {"row": r, "col": c, "cone_size": 0}
                board[r][c] = None
        return None
    
    def find_open_four(self, board, player, board_size):
        """Find open-four pattern"""
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                board[r][c] = {"player": player, "size": 0}
                for dr, dc in directions:
                    count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
                    if count == 4 and self.is_line_open_both_ends(board, r, c, dr, dc, player, board_size):
                        board[r][c] = None
                        return {"row": r, "col": c, "cone_size": 0}
                board[r][c] = None
        return None
    
    def check_win_from_move(self, board, r, c, player, board_size):
        """Check if move at (r,c) wins"""
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        for dr, dc in directions:
            count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
            if count >= 5:
                return True
        return False
    
    def check_win_fast(self, board, board_size):
        """Fast win detection"""
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or not board[r][c]:
                    continue
                player = board[r][c]['player']
                for dr, dc in directions:
                    count = 1
                    for i in range(1, 5):
                        nr, nc = r + dr*i, c + dc*i
                        if (nr < 0 or nr >= board_size or nc < 0 or nc >= board_size or
                            nr >= len(board) or nc >= len(board[nr])):
                            break
                        if board[nr][nc] and board[nr][nc]['player'] == player:
                            count += 1
                        else:
                            break
                    if count >= 5:
                        return player
        return None
    
    def strategic_move(self, board, player, board_size):
        """Strategic fallback move"""
        # Try center area first
        center = board_size // 2
        for offset in range(5):
            for dr in range(-offset, offset+1):
                for dc in range(-offset, offset+1):
                    r, c = center + dr, center + dc
                    if 0 <= r < board_size and 0 <= c < board_size:
                        if r < len(board) and c < len(board[r]) and board[r][c] is None:
                            # Evaluate this position
                            score = self.score_move_position(board, r, c, player, board_size)
                            if score > 5:
                                return {"row": r, "col": c, "cone_size": 0}
        
        # Absolute fallback
        for r in range(board_size):
            for c in range(board_size):
                if r < len(board) and c < len(board[r]) and board[r][c] is None:
                    return {"row": r, "col": c, "cone_size": 0}
        return None
