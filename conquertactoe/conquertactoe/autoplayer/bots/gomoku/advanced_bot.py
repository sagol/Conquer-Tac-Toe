import random
import time
from typing import Dict, Any, Optional
from core.bot_interface import IBot

class GomokuBot(IBot):
    """Advanced Gomoku bot with minimax search and pattern recognition"""
    
    def __init__(self):
        self.max_depth = 4  # Start with depth 4 for performance
        self.max_time = 2.5  # seconds
        self.pattern_weights = {
            'five': 100000,
            'open_four': 10000,
            'four': 1000,
            'open_three': 100,
            'broken_three': 50,
            'three': 10,
            'two': 1
        }

    @property
    def name(self) -> str:
        return "Advanced Gomoku Bot"
    
    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Get move using minimax for complex positions, pattern-based for simple ones
        """
        board = game_state.get("board")
        board_size = game_state.get("board_size", 15)
        # Assuming bot is player 2 for now, similar to classic
        player = 2
        
        if not board:
            return None

        actual_board_size = len(board) if board else board_size
        opponent = 1 if player == 2 else 2
        
        # Priority 1: Win immediately
        winning_move = self.find_winning_move(board, player, actual_board_size)
        if winning_move:
            return winning_move
        
        # Priority 2: Block opponent's open four (unstoppable)
        block_open_four = self.find_open_four(board, opponent, actual_board_size)
        if block_open_four:
            return block_open_four
        
        # Priority 3: Block opponent's four
        block_four = self.find_four_pattern(board, opponent, actual_board_size)
        if block_four:
            return block_four
        
        # Use minimax for complex positions (when there are threats)
        if self.should_use_minimax(board, player, actual_board_size):
            minimax_move = self.minimax_search(board, player, actual_board_size)
            if minimax_move:
                return minimax_move
        
        # Fallback to pattern-based approach
        return self.pattern_based_move(board, player, actual_board_size)
    
    def should_use_minimax(self, board, player, board_size):
        """Decide if we should use minimax (for complex positions)"""
        # Count total pieces on board
        piece_count = sum(1 for r in range(board_size) for c in range(board_size) 
                         if r < len(board) and c < len(board[r]) and board[r][c] is not None)
        
        # Use minimax after opening (5+ pieces) but not in endgame (too slow)
        return 5 <= piece_count <= 40
    
    def minimax_search(self, board, player, board_size):
        """Minimax search with alpha-beta pruning"""
        start_time = time.time()
        
        best_score = float('-inf')
        best_move = None
        alpha = float('-inf')
        beta = float('inf')
        
        # Get ordered moves (most promising first)
        moves = self.get_ordered_moves(board, player, board_size)
        
        for move in moves[:20]:  # Limit to top 20 moves
            if time.time() - start_time > self.max_time:
                break
            
            # Try move
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
        """Minimax algorithm with alpha-beta pruning"""
        if time.time() - start_time > self.max_time:
            return 0
        
        # Check terminal conditions
        winner = self.check_win_fast(board, board_size)
        if winner == bot_player:
            return 10000 + depth  # Prefer faster wins
        elif winner:
            return -10000 - depth  # Avoid slower losses
        
        if depth == 0:
            return self.evaluate_position(board, bot_player, board_size)
        
        if is_maximizing:
            max_eval = float('-inf')
            moves = self.get_ordered_moves(board, bot_player, board_size)
            for move in moves[:15]:  # Limit branching factor
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
            return max_eval
        else:
            opponent = 1 if bot_player == 2 else 2
            min_eval = float('inf')
            moves = self.get_ordered_moves(board, opponent, board_size)
            for move in moves[:15]:
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
            return min_eval
    
    def evaluate_position(self, board, player, board_size):
        """Evaluate board position using pattern recognition"""
        opponent = 1 if player == 2 else 2
        score = 0
        
        # Count patterns for both players
        my_patterns = self.count_all_patterns(board, player, board_size)
        opp_patterns = self.count_all_patterns(board, opponent, board_size)
        
        for pattern_type, weight in self.pattern_weights.items():
            score += weight * (my_patterns.get(pattern_type, 0) - opp_patterns.get(pattern_type, 0))
        
        return score
    
    def count_all_patterns(self, board, player, board_size):
        """Count all pattern types for a player"""
        patterns = {
            'five': 0,
            'open_four': 0,
            'four': 0,
            'open_three': 0,
            'broken_three': 0,
            'three': 0,
            'two': 0
        }
        
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]):
                    continue
                if board[r][c] and board[r][c]['player'] == player:
                    for dr, dc in directions:
                        pattern = self.analyze_line(board, r, c, dr, dc, player, board_size)
                        if pattern:
                            patterns[pattern] = patterns.get(pattern, 0) + 1
        
        return patterns
    
    def analyze_line(self, board, r, c, dr, dc, player, board_size):
        """Analyze a line starting from (r,c) in direction (dr,dc)"""
        count = 1
        gaps = 0
        
        # Count in positive direction
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
        
        # Determine pattern type
        if count >= 5:
            return 'five'
        elif count == 4:
            # Check if open on both ends
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
        """Simplified check if sequence has both ends open"""
        # Find start and end of sequence
        start_r, start_c = r, c
        end_r, end_c = r, c
        
        # Find end
        for i in range(1, length):
            end_r, end_c = end_r + dr, end_c + dc
        
        # Check if both ends are empty
        before_r, before_c = start_r - dr, start_c - dc
        after_r, after_c = end_r + dr, end_c + dc
        
        before_open = (0 <= before_r < board_size and 0 <= before_c < board_size and
                      before_r < len(board) and before_c < len(board[before_r]) and
                      board[before_r][before_c] is None)
        
        after_open = (0 <= after_r < board_size and 0 <= after_c < board_size and
                     after_r < len(board) and after_c < len(board[after_r]) and
                     board[after_r][after_c] is None)
        
        return before_open and after_open
    
    def get_ordered_moves(self, board, player, board_size):
        """Get moves ordered by priority (best moves first)"""
        moves_with_scores = []
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]):
                    continue
                if board[r][c] is None:
                    # Score based on proximity to existing pieces
                    score = self.score_move_position(board, r, c, player, board_size)
                    if score > 0:  # Only consider moves near existing pieces
                        moves_with_scores.append(((r, c), score))
        
        # Sort by score (descending)
        moves_with_scores.sort(key=lambda x: x[1], reverse=True)
        return [move for move, score in moves_with_scores]
    
    def score_move_position(self, board, r, c, player, board_size):
        """Score a move position based on nearby pieces"""
        score = 0
        
        # Higher score for positions near friendly pieces
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
    
    def check_win_fast(self, board, board_size):
        """Fast win check for minimax"""
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]):
                    continue
                if board[r][c]:
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
        """Pattern-based move selection (fallback)"""
        opponent = 1 if player == 2 else 2
        
        # Try to create open four
        create_open_four = self.find_open_four_opportunity(board, player, board_size)
        if create_open_four:
            return create_open_four
        
        # Try to create four
        create_four = self.find_four_opportunity(board, player, board_size)
        if create_four:
            return create_four
        
        # Block opponent's open three
        block_open_three = self.find_open_three(board, opponent, board_size)
        if block_open_three:
            return block_open_three
        
        # Create own open three
        create_open_three = self.find_open_three_opportunity(board, player, board_size)
        if create_open_three:
            return create_open_three
        
        # Strategic move
        strategic_move = self.find_strategic_move(board, player, board_size)
        if strategic_move:
            return strategic_move
        
        return self.get_random_move(board, board_size)
    
    # Keep all existing pattern detection methods from previous implementation
    def find_winning_move(self, board, player, board_size):
        """Find move that creates 5-in-a-row"""
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]):
                    continue
                if board[r][c] is None:
                    board[r][c] = {"player": player, "size": 0}
                    if self.check_win(board, player, r, c, board_size):
                        board[r][c] = None
                        return {"row": r, "col": c, "cone_size": 0}
                    board[r][c] = None
        return None
    
    def find_open_four(self, board, player, board_size):
        return self.find_pattern_move(board, player, board_size, 4, both_open=True)
    
    def find_four_pattern(self, board, player, board_size):
        return self.find_pattern_move(board, player, board_size, 4, both_open=False)
    
    def find_open_four_opportunity(self, board, player, board_size):
        return self.find_pattern_move(board, player, board_size, 4, both_open=True, create=True)
    
    def find_four_opportunity(self, board, player, board_size):
        return self.find_pattern_move(board, player, board_size, 4, both_open=False, create=True)
    
    def find_open_three(self, board, player, board_size):
        return self.find_pattern_move(board, player, board_size, 3, both_open=True)
    
    def find_open_three_opportunity(self, board, player, board_size):
        return self.find_pattern_move(board, player, board_size, 3, both_open=True, create=True)
    
    def find_pattern_move(self, board, player, board_size, length, both_open=False, create=False):
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]):
                    continue
                if board[r][c] is not None:
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
    
    def find_strategic_move(self, board, player, board_size):
        best_score = -1
        best_move = None
        
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]):
                    continue
                if board[r][c] is None:
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
        
        return best_move if best_score > 0 else None
    
    def check_win(self, board, player, r, c, board_size):
        directions = [(0,1), (1,0), (1,1), (1,-1)]
        for dr, dc in directions:
            count = self.count_consecutive(board, r, c, dr, dc, player, board_size)
            if count >= 5:
                return True
        return False
    
    def get_random_move(self, board, board_size):
        valid_moves = []
        for r in range(board_size):
            for c in range(board_size):
                if r >= len(board) or c >= len(board[r]):
                    continue
                if board[r][c] is None:
                    near_piece = False
                    for dr in range(-2, 3):
                        for dc in range(-2, 3):
                            nr, nc = r + dr, c + dc
                            if 0 <= nr < board_size and 0 <= nc < board_size:
                                if nr < len(board) and nc < len(board[nr]):
                                    if board[nr][nc] is not None:
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
