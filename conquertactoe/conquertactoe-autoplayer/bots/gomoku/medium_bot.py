import random
import time
from typing import Dict, Any, Optional
from core.bot_interface import IBot

class GomokuMediumBot(IBot):
    """Medium difficulty Gomoku bot with VCF detection and deeper search"""
    
    def __init__(self):
        self.max_depth = 10  # Significantly deeper than easy (4)
        self.max_time = 4.0  # More time for deeper search
        self.randomness = 0.05  # 5% chance for variety
        # Enhanced pattern weights for medium difficulty
        self.pattern_weights = {
            'five': 100000,
            'open_four': 15000,  # Increased importance
            'four': 2000,
            'open_three': 300,
            'broken_three': 80,
            'three': 15,
            'two': 2
        }
        self.transposition_table = {}
    
    @property
    def name(self) -> str:
        return "Gomoku Medium Bot"
    
    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Medium bot with VCF detection and threat analysis"""
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
        
        
        # Priority 1: Win immediately
        winning_move = self.find_winning_move(board, player, actual_board_size)
        if winning_move:
            return winning_move
        
        # Priority 2: Block opponent's open four
        block_open_four = self.find_open_four(board, opponent, actual_board_size)
        if block_open_four:
            return block_open_four
        
        # Priority 3: Block opponent's four
        block_four = self.find_four_pattern(board, opponent, actual_board_size)
        if block_four:
            return block_four
        
        # Priority 4: Create own open four
        create_open_four = self.find_open_four(board, player, actual_board_size)
        if create_open_four:
            return create_open_four
        
        # Priority 5: VCF (Victory by Continuous Four) search
        vcf_move = self.find_vcf_sequence(board, player, actual_board_size)
        if vcf_move:
            return vcf_move
        
        # Add randomness: 15% chance to skip minimax and play tactically
        if random.random() < self.randomness:
            return self.pattern_based_move(board, player, actual_board_size)
        
        # Use minimax for complex positions
        minimax_move = self.minimax_search(board, player, actual_board_size)
        if minimax_move:
            return minimax_move
        
        # Fallback to strategic move
        return self.pattern_based_move(board, player, actual_board_size)
    
    def find_vcf_sequence(self, board, player, board_size, depth=0, max_depth=3):
        """
        Victory by Continuous Four: Find sequence of forcing moves (open-threes, fours)
        that lead to unstoppable victory
        """
        if depth >= max_depth:
            return None
        
        opponent = 1 if player == 2 else 2
        
        # Find moves that create open-three or four
        threatening_moves = []
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                
                # Try move
                board[r][c] = {"player": player, "size": 0}
                
                # Check if this creates a strong threat
                if self.creates_open_three(board, r, c, player, board_size):
                    threatening_moves.append((r, c, 3))  # priority 3 for open-three
                elif self.creates_four(board, r, c, player, board_size):
                    threatening_moves.append((r, c, 2))  # priority 2 for four
                
                board[r][c] = None
        
        # Try threatening moves in order of priority
        threatening_moves.sort(key=lambda x: x[2])
        
        for r, c, _ in threatening_moves[:5]:  # Limit search
            board[r][c] = {"player": player, "size": 0}
            
            # Check if opponent has forced responses
            opponent_responses = self.find_all_defensive_moves(board, opponent, board_size)
            
            # If opponent has only one forced response, continue VCF search
            if len(opponent_responses) == 1:
                opp_r, opp_c = opponent_responses[0]
                board[opp_r][opp_c] = {"player": opponent, "size": 0}
                
                # Recursively search for VCF
                next_move = self.find_vcf_sequence(board, player, board_size, depth + 1, max_depth)
                
                board[opp_r][opp_c] = None
                
                if next_move or self.check_win(board, player, r, c, board_size):
                    board[r][c] = None
                    return {"row": r, "col": c, "cone_size": 0}
            
            board[r][c] = None
        
        return None
    
    def creates_open_three(self, board, r, c, player, board_size):
        """Check if move at (r,c) creates an open-three"""
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        for dr, dc in directions:
            count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
            if count == 3 and self.is_open_both_ends(board, r, c, dr, dc, count, board_size):
                return True
        return False
    
    def creates_four(self, board, r, c, player, board_size):
        """Check if move at (r,c) creates a four"""
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        for dr, dc in directions:
            count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
            if count >= 4:
                return True
        return False
    
    def find_all_defensive_moves(self, board, player, board_size):
        """Find all moves that defend against immediate threats"""
        defensive_moves = []
        
        # Find all four-patterns that need blocking
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                
                board[r][c] = {"player": player, "size": 0}
                if self.creates_four(board, r, c, player, board_size):
                    defensive_moves.append((r, c))
                board[r][c] = None
        
        return defensive_moves
    
    def minimax_search(self, board, player, board_size):
        """Minimax search with increased depth for medium difficulty"""
        start_time = time.time()
        self.transposition_table.clear()
        
        best_score = float('-inf')
        best_move = None
        alpha = float('-inf')
        beta = float('inf')
        
        moves = self.get_ordered_moves(board, player, board_size)
        
        for move in moves[:25]:  # Increased from 20
            if time.time() - start_time > self.max_time:
                break
            
            board[move[0]][move[1]] = {"player": player, "size": 0}
            score = self.minimax(board, self.max_depth - 1, False, alpha, beta, 
                                player, board_size, start_time)
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
    
    def minimax(self, board, depth, is_maximizing, alpha, beta, bot_player, board_size, start_time):
        """Enhanced minimax with transposition table"""
        if time.time() - start_time > self.max_time:
            return 0
        
        board_key = self.get_board_key(board, board_size)
        if board_key in self.transposition_table:
            return self.transposition_table[board_key]
        
        winner = self.check_win_fast(board, board_size)
        if winner == bot_player:
            return 10000 + depth
        elif winner:
            return -10000 - depth
        
        if depth == 0:
            eval_score = self.evaluate_position(board, bot_player, board_size)
            self.transposition_table[board_key] = eval_score
            return eval_score
        
        if is_maximizing:
            max_eval = float('-inf')
            moves = self.get_ordered_moves(board, bot_player, board_size)
            for move in moves[:20]:
                if time.time() - start_time > self.max_time:
                    break
                board[move[0]][move[1]] = {"player": bot_player, "size": 0}
                eval_score = self.minimax(board, depth - 1, False, alpha, beta, 
                                         bot_player, board_size, start_time)
                board[move[0]][move[1]] = None
                max_eval = max(max_eval, eval_score)
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    break
            self.transposition_table[board_key] = max_eval
            return max_eval
        else:
            opponent = 1 if bot_player == 2 else 2
            min_eval = float('inf')
            moves = self.get_ordered_moves(board, opponent, board_size)
            for move in moves[:20]:
                if time.time() - start_time > self.max_time:
                    break
                board[move[0]][move[1]] = {"player": opponent, "size": 0}
                eval_score = self.minimax(board, depth - 1, True, alpha, beta, 
                                         bot_player, board_size, start_time)
                board[move[0]][move[1]] = None
                min_eval = min(min_eval, eval_score)
                beta = min(beta, eval_score)
                if beta <= alpha:
                    break
            self.transposition_table[board_key] = min_eval
            return min_eval
    
    def get_board_key(self, board, board_size):
        """Create hashable board key"""
        key_list = []
        for r in range(min(board_size, len(board))):
            for c in range(min(board_size, len(board[r]) if r < len(board) else 0)):
                cell = board[r][c] if r < len(board) and c < len(board[r]) else None
                if cell:
                    key_list.append((r, c, cell['player']))
        return tuple(key_list)
    
    # Copy helper methods from easy_bot
    def evaluate_position(self, board, player, board_size):
        """Evaluate position using pattern recognition"""
        opponent = 1 if player == 2 else 2
        score = 0
        
        my_patterns = self.count_all_patterns(board, player, board_size)
        opp_patterns = self.count_all_patterns(board, opponent, board_size)
        
        for pattern_type, weight in self.pattern_weights.items():
            score += weight * (my_patterns.get(pattern_type, 0) - opp_patterns.get(pattern_type, 0))
        
        return score
    
    def count_all_patterns(self, board, player, board_size):
        """Count all pattern types (from easy_bot)"""
        patterns = {'five': 0, 'open_four': 0, 'four': 0, 'open_three': 0, 'broken_three': 0, 'three': 0, 'two': 0}
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or not board[r][c] or board[r][c]['player'] != player:
                    continue
                for dr, dc in directions:
                    pattern = self.analyze_line(board, r, c, dr, dc, player, board_size)
                    if pattern:
                        patterns[pattern] = patterns.get(pattern, 0) + 1
        return patterns
    
    def analyze_line(self, board, r, c, dr, dc, player, board_size):
        """Analyze line from easy_bot"""
        count = 1
        gaps = 0
        
        for i in range(1, 6):
            nr, nc = r + dr*i, c + dc*i
            if nr < 0 or nr >= board_size or nc < 0 or nc >= board_size:
                break
            if nr >= len(board) or nc >= len(board[nr]):
                break
            if board[nr][nc] and board[nr][nc]['player'] == player:
                count += 1
            elif board[nr][nc] is None and gaps == 0:
                gaps += 1
            else:
                break
        
        if count >= 5:
            return 'five'
        elif count == 4:
            if self.is_open_both_ends_simple(board, r, c, dr, dc, count, board_size, player):
                return 'open_four'
            return 'four'
        elif count == 3:
            if gaps == 1:
                return 'broken_three'
            elif self.is_open_both_ends_simple(board, r, c, dr, dc, count, board_size, player):
                return 'open_three'
            return 'three'
        elif count == 2:
            return 'two'
        return None
    
    def is_open_both_ends_simple(self, board, r, c, dr, dc, length, board_size, player):
        """Check if both ends open (from easy_bot)"""
        start_r, start_c = r, c
        end_r, end_c = r, c
        for i in range(1, length):
            end_r, end_c = end_r + dr, end_c + dc
        before_r, before_c = start_r - dr, start_c - dc
        after_r, after_c = end_r + dr, end_c + dc
        before_open = (0 <= before_r < board_size and 0 <= before_c < board_size and
                      before_r < len(board) and before_c < len(board[before_r]) and
                      board[before_r][before_c] is None)
        after_open = (0 <= after_r < board_size and 0 <= after_c < board_size and
                     after_r < len(board) and after_c < len(board[after_r]) and
                     board[after_r][after_c] is None)
        return before_open and after_open
    
    # Include other necessary methods from easy_bot: get_ordered_moves, find_winning_move, 
    # find_open_four, find_four_pattern, count_consecutive, is_open_both_ends, 
    # check_win, check_win_fast, pattern_based_move, get_random_move, etc.
    
    # For brevity, include references - copy from easy_bot.py lines 256-536
    def get_ordered_moves(self, board, player, board_size):
        """Get moves ordered by priority"""
        moves_with_scores = []
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                score = self.score_move_position(board, r, c, player, board_size)
                if score > 0:
                    moves_with_scores.append(((r, c), score))
        moves_with_scores.sort(key=lambda x: x[1], reverse=True)
        return [move for move, score in moves_with_scores]
    
    def score_move_position(self, board, r, c, player, board_size):
        """Score move position"""
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
                            score += (4 - distance)
                        elif board[nr][nc]:
                            score += 1
        return score
    
    def find_winning_move(self, board, player, board_size):
        """Find immediate winning move"""
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                board[r][c] = {"player": player, "size": 0}
                if self.check_win(board, player, r, c, board_size):
                    board[r][c] = None
                    return {"row": r, "col": c, "cone_size": 0}
                board[r][c] = None
        return None
    
    def find_open_four(self, board, player, board_size):
        """Find open four pattern"""
        return self.find_pattern_move(board, player, board_size, 4, both_open=True)
    
    def find_four_pattern(self, board, player, board_size):
        """Find four pattern"""
        return self.find_pattern_move(board, player, board_size, 4, both_open=False)
    
    def find_pattern_move(self, board, player, board_size, length, both_open=False, create=False):
        """Find pattern move"""
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                board[r][c] = {"player": player, "size": 0}
                for dr, dc in directions:
                    count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
                    if count >= length:
                        if both_open:
                            if self.is_open_both_ends(board, r, c, dr, dc, count, board_size):
                                board[r][c] = None
                                return {"row": r, "col": c, "cone_size": 0}
                        else:
                            board[r][c] = None
                            return {"row": r, "col": c, "cone_size": 0}
                board[r][c] = None
        return None
    
    def count_consecutive(self, board, r, c, dr, dc, player, board_size):
        """Count consecutive pieces"""
        count = 1
        for i in range(1, 5):
            nr, nc = r + dr*i, c + dc*i
            if nr < 0 or nr >= board_size or nc < 0 or nc >= board_size:
                break
            if nr >= len(board) or nc >= len(board[nr]):
                break
            if board[nr][nc] and board[nr][nc]['player'] == player:
                count += 1
            else:
                break
        for i in range(1, 5):
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
    
    def is_open_both_ends(self, board, r, c, dr, dc, count, board_size):
        """Check if both ends open"""
        start_offset = 0
        for i in range(1, 5):
            nr, nc = r - dr*i, c - dc*i
            if nr < 0 or nr >= board_size or nc < 0 or nc >= board_size:
                break
            if nr >= len(board) or nc >= len(board[nr]):
                break
            if board[nr][nc] and board[nr][nc]['player'] == board[r][c]['player']:
                start_offset = i
            else:
                break
        end_offset = 0
        for i in range(1, 5):
            nr, nc = r + dr*i, c + dc*i
            if nr < 0 or nr >= board_size or nc < 0 or nc >= board_size:
                break
            if nr >= len(board) or nc >= len(board[nr]):
                break
            if board[nr][nc] and board[nr][nc]['player'] == board[r][c]['player']:
                end_offset = i
            else:
                break
        start_r, start_c = r - dr*(start_offset + 1), c - dc*(start_offset + 1)
        end_r, end_c = r + dr*(end_offset + 1), c + dc*(end_offset + 1)
        start_open = (0 <= start_r < board_size and 0 <= start_c < board_size and 
                      start_r < len(board) and start_c < len(board[start_r]) and
                      board[start_r][start_c] is None)
        end_open = (0 <= end_r < board_size and 0 <= end_c < board_size and
                    end_r < len(board) and end_c < len(board[end_r]) and
                    board[end_r][end_c] is None)
        return start_open and end_open
    
    def check_win(self, board, player, r, c, board_size):
        """Check win"""
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        for dr, dc in directions:
            count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
            if count >= 5:
                return True
        return False
    
    def check_win_fast(self, board, board_size):
        """Fast win check"""
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
    
    def pattern_based_move(self, board, player, board_size):
        """Pattern-based fallback"""
        # Try strategic move
        best_score = -1
        best_move = None
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                score = self.score_move_position(board, r, c, player, board_size)
                if score > best_score:
                    best_score = score
                    best_move = {"row": r, "col": c, "cone_size": 0}
        if best_score < 5:
            center = board_size // 2
            for offset in range(3):
                for dr in [-offset, 0, offset]:
                    for dc in [-offset, 0, offset]:
                        r, c = center + dr, center + dc
                        if 0 <= r < board_size and 0 <= c < board_size:
                            if r < len(board) and c < len(board[r]) and board[r][c] is None:
                                return {"row": r, "col": c, "cone_size": 0}
        return best_move if best_score > 0 else self.get_random_move(board, board_size)
    
    def get_random_move(self, board, board_size):
        """Random fallback"""
        valid_moves = []
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]) or board[r][c] is not None:
                    continue
                near_piece = False
                for dr in range(-2, 3):
                    for dc in range(-2, 3):
                        nr, nc = r + dr, c + dc
                        if 0 <= nr < board_size and 0 <= nc < board_size:
                            if nr < len(board) and nc < len(board[nr]) and board[nr][nc] is not None:
                                near_piece = True
                                break
                    if near_piece:
                        break
                if near_piece:
                    valid_moves.append((r, c))
        if not valid_moves:
            valid_moves = [(r, c) for r in range(board_size) for c in range(board_size)
                          if r < len(board) and c < len(board[r]) and board[r][c] is None]
        if valid_moves:
            r, c = random.choice(valid_moves)
            return {"row": r, "col": c, "cone_size": 0}
        return None
