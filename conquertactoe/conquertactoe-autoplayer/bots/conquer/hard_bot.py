import random
from typing import Dict, Any, Optional, List, Tuple
from core.bot_interface import IBot

class ConquerHardBot(IBot):
    """Hard difficulty bot for Conquer variants - Expert level with deep minimax"""
    
    def __init__(self):
        self.max_depth = 8  # Deep search for cone-aware minimax
        self.transposition_table = {}
        
    @property
    def name(self) -> str:
        return "Conquer Hard Bot (Expert)"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Expert strategy:
        - Deep cone-aware minimax (depth 6-8)
        - Advanced board evaluation
        - Forced win detection
        - Multi-threat tactics
        - Endgame solver
        """
        board = game_state.get("board")
        bot_cones = game_state.get("bot_cones")
        player_cones = game_state.get("player_cones")
        
        if not board or not bot_cones:
            return None

        total_cones_remaining = sum(bot_cones) + sum(player_cones)
        
        # 1. Immediate win
        winning_move = self.find_winning_move(board, bot_cones)
        if winning_move:
            return winning_move

        # 2. Block opponent's immediate win
        blocking_move = self.find_blocking_move(board, bot_cones, player_cones)
        if blocking_move:
            return blocking_move

        # 3. Endgame solver (when few cones remain)
        if total_cones_remaining <= 8:  # Endgame threshold
            endgame_move = self.solve_endgame(board, bot_cones, player_cones)
            if endgame_move:
                return endgame_move

        # 4. Forced win detection
        forced_win = self.find_forced_win_sequence(board, bot_cones, player_cones)
        if forced_win:
            return forced_win

        # 5. Deep minimax search
        minimax_move = self.cone_aware_minimax(board, bot_cones, player_cones)
        if minimax_move:
            return minimax_move

        # 6. Fallback: best heuristic move
        return self.find_best_heuristic_move(board, bot_cones, player_cones)

    def solve_endgame(self, board, bot_cones, player_cones):
        """
        Perfect endgame solver when ≤8 cones remain
        Uses exhaustive search to find guaranteed win or best defense
        """
        # Try all possible moves and evaluate to game end
        best_move = None
        best_outcome = float('-inf')
        
        for size_idx in range(len(bot_cones)):
            if bot_cones[size_idx] <= 0:
                continue
            
            for r in range(3):
                for c in range(3):
                    if not self.is_valid_move(board, r, c, size_idx, 2):
                        continue
                    
                    # Try this move
                    original = board[r][c]
                    board[r][c] = {"player": 2, "size": size_idx}
                    new_bot_cones = bot_cones.copy()
                    if new_bot_cones[size_idx] < 900:
                        new_bot_cones[size_idx] -= 1
                    
                    # Recursively evaluate to completion
                    outcome = self.minimax_to_end(board, new_bot_cones, player_cones, 
                                                   depth=0, is_maximizing=False, player=2)
                    
                    board[r][c] = original
                    
                    if outcome > best_outcome:
                        best_outcome = outcome
                        best_move = {"row": r, "col": c, "cone_size": size_idx}
                    
                    # If we found a guaranteed win, take it
                    if best_outcome >= 1000:
                        return best_move
        
        return best_move

    def minimax_to_end(self, board, bot_cones, player_cones, depth, is_maximizing, player):
        """Minimax that searches to game completion (for endgame)"""
        # Check terminal states
        if self.check_win(board, 2):
            return 1000 - depth  # Win (prefer faster)
        if self.check_win(board, 1):
            return depth - 1000  # Loss (prefer slower)
        
        # Check if game is over (no valid moves)
        if not self.has_valid_moves(board, bot_cones if is_maximizing else player_cones, 
                                      2 if is_maximizing else 1):
            if not self.has_valid_moves(board, player_cones if is_maximizing else bot_cones,
                                        1 if is_maximizing else 2):
                return 0  # Draw
        
        # Depth limit for performance (even in endgame)
        if depth >= 12:
            return self.evaluate_position(board, bot_cones, player_cones)
        
        if is_maximizing:
            max_eval = float('-inf')
            for size_idx in range(len(bot_cones)):
                if bot_cones[size_idx] <= 0:
                    continue
                for r in range(3):
                    for c in range(3):
                        if not self.is_valid_move(board, r, c, size_idx, 2):
                            continue
                        original = board[r][c]
                        board[r][c] = {"player": 2, "size": size_idx}
                        new_bot_cones = bot_cones.copy()
                        if new_bot_cones[size_idx] < 900:
                            new_bot_cones[size_idx] -= 1
                        eval = self.minimax_to_end(board, new_bot_cones, player_cones, 
                                                   depth + 1, False, 2)
                        board[r][c] = original
                        max_eval = max(max_eval, eval)
            return max_eval if max_eval != float('-inf') else 0
        else:
            min_eval = float('inf')
            for size_idx in range(len(player_cones)):
                if player_cones[size_idx] <= 0:
                    continue
                for r in range(3):
                    for c in range(3):
                        if not self.is_valid_move(board, r, c, size_idx, 1):
                            continue
                        original = board[r][c]
                        board[r][c] = {"player": 1, "size": size_idx}
                        new_player_cones = player_cones.copy()
                        if new_player_cones[size_idx] < 900:
                            new_player_cones[size_idx] -= 1
                        eval = self.minimax_to_end(board, bot_cones, new_player_cones,
                                                   depth + 1, True, 1)
                        board[r][c] = original
                        min_eval = min(min_eval, eval)
            return min_eval if min_eval != float('inf') else 0

    def find_forced_win_sequence(self, board, bot_cones, player_cones):
        """
        Find sequence of moves that guarantees victory
        (creates multiple simultaneous threats)
        """
        # Look for moves that create 2+ threats
        for size_idx in range(len(bot_cones)):
            if bot_cones[size_idx] <= 0:
                continue
            
            for r in range(3):
                for c in range(3):
                    if not self.is_valid_move(board, r, c, size_idx, 2):
                        continue
                    
                    # Try move
                    original = board[r][c]
                    board[r][c] = {"player": 2, "size": size_idx}
                    
                    # Count winning threats created
                    winning_threats = self.count_winning_threats(board, 2)
                    
                    board[r][c] = original
                    
                    # If we create 2+ threats, opponent can't block both
                    if winning_threats >= 2:
                        return {"row": r, "col": c, "cone_size": size_idx}
        
        return None

    def count_winning_threats(self, board, player):
        """Count number of lines where player needs only 1 more piece to win"""
        lines = [
            [(0,0), (0,1), (0,2)], [(1,0), (1,1), (1,2)], [(2,0), (2,1), (2,2)],
            [(0,0), (1,0), (2,0)], [(0,1), (1,1), (2,1)], [(0,2), (1,2), (2,2)],
            [(0,0), (1,1), (2,2)], [(0,2), (1,1), (2,0)]
        ]
        
        threats = 0
        for line in lines:
            our_count = sum(1 for r, c in line if board[r][c] and board[r][c]['player'] == player)
            empty_count = sum(1 for r, c in line if board[r][c] is None)
            opponent_count = sum(1 for r, c in line if board[r][c] and board[r][c]['player'] != player)
            
            # Threat: 2 of ours, 1 empty, 0 opponent
            if our_count == 2 and empty_count == 1 and opponent_count == 0:
                threats += 1
        
        return threats

    def cone_aware_minimax(self, board, bot_cones, player_cones):
        """
        Deep minimax search with cone inventory tracking
        """
        self.transposition_table.clear()
        
        best_move = None
        best_score = float('-inf')
        alpha = float('-inf')
        beta = float('inf')
        
        # Try moves in intelligent order
        moves = self.get_ordered_moves(board, bot_cones, 2)
        
        for r, c, size_idx in moves:
            # Make move
            original = board[r][c]
            board[r][c] = {"player": 2, "size": size_idx}
            new_bot_cones = bot_cones.copy()
            if new_bot_cones[size_idx] < 900:
                new_bot_cones[size_idx] -= 1
            
            # Evaluate
            score = self.minimax_cone(board, new_bot_cones, player_cones, 
                                      self.max_depth - 1, False, alpha, beta)
            
            # Undo move
            board[r][c] = original
            
            if score > best_score:
                best_score = score
                best_move = {"row": r, "col": c, "cone_size": size_idx}
            
            alpha = max(alpha, score)
            if beta <= alpha:
                break
        
        return best_move

    def minimax_cone(self, board, bot_cones, player_cones, depth, is_maximizing, alpha, beta):
        """Minimax with cone awareness"""
        # Terminal checks
        if self.check_win(board, 2):
            return 10000 + depth
        if self.check_win(board, 1):
            return depth - 10000
        
        if depth == 0:
            return self.evaluate_position(board, bot_cones, player_cones)
        
        if is_maximizing:
            max_eval = float('-inf')
            moves = self.get_ordered_moves(board, bot_cones, 2)
            
            for r, c, size_idx in moves[:15]:  # Limit branching
                original = board[r][c]
                board[r][c] = {"player": 2, "size": size_idx}
                new_bot_cones = bot_cones.copy()
                if new_bot_cones[size_idx] < 900:
                    new_bot_cones[size_idx] -= 1
                
                eval = self.minimax_cone(board, new_bot_cones, player_cones,
                                        depth - 1, False, alpha, beta)
                
                board[r][c] = original
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            
            return max_eval if max_eval != float('-inf') else 0
        else:
            min_eval = float('inf')
            moves = self.get_ordered_moves(board, player_cones, 1)
            
            for r, c, size_idx in moves[:15]:
                original = board[r][c]
                board[r][c] = {"player": 1, "size": size_idx}
                new_player_cones = player_cones.copy()
                if new_player_cones[size_idx] < 900:
                    new_player_cones[size_idx] -= 1
                
                eval = self.minimax_cone(board, bot_cones, new_player_cones,
                                        depth - 1, True, alpha, beta)
                
                board[r][c] = original
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            
            return min_eval if min_eval != float('inf') else 0

    def evaluate_position(self, board, bot_cones, player_cones):
        """
        Advanced board evaluation:
        - Control score (cells dominated)
        - Cone efficiency (value per cone used)
        - Threat potential (future winning paths)
        - Defensive stability
        """
        score = 0
        
        # 1. Control score - count lines dominated
        score += self.evaluate_line_control(board, 2) * 100
        score -= self.evaluate_line_control(board, 1) * 120  # Weight opponent higher
        
        # 2. Cone efficiency - reward having more/larger cones
        our_cone_value = sum((i+1) * count for i, count in enumerate(bot_cones) if count < 900)
        opp_cone_value = sum((i+1) * count for i, count in enumerate(player_cones) if count < 900)
        score += (our_cone_value - opp_cone_value) * 50
        
        # 3. Threat potential
        score += self.count_winning_threats(board, 2) * 300
        score -= self.count_winning_threats(board, 1) * 400
        
        # 4. Position control (center, corners)
        if board[1][1] and board[1][1]['player'] == 2:
            score += 150
        elif board[1][1] and board[1][1]['player'] == 1:
            score -= 180
        
        corners = [(0,0), (0,2), (2,0), (2,2)]
        for r, c in corners:
            if board[r][c] and board[r][c]['player'] == 2:
                score += 80
            elif board[r][c] and board[r][c]['player'] == 1:
                score -= 100
        
        return score

    def evaluate_line_control(self, board, player):
        """Evaluate how many lines player controls/threatens"""
        lines = [
            [(0,0), (0,1), (0,2)], [(1,0), (1,1), (1,2)], [(2,0), (2,1), (2,2)],
            [(0,0), (1,0), (2,0)], [(0,1), (1,1), (2,1)], [(0,2), (1,2), (2,2)],
            [(0,0), (1,1), (2,2)], [(0,2), (1,1), (2,0)]
        ]
        
        control = 0
        for line in lines:
            our_count = sum(1 for r, c in line if board[r][c] and board[r][c]['player'] == player)
            opp_count = sum(1 for r, c in line if board[r][c] and board[r][c]['player'] != player and board[r][c] is not None)
            
            if opp_count == 0:  # Line not blocked
                control += our_count ** 2  # Exponential reward
        
        return control

    def get_ordered_moves(self, board, cones, player):
        """Get moves in priority order"""
        moves = []
        
        # Priority order: larger cones in better positions
        position_values = {
            (1,1): 5, (0,0): 3, (0,2): 3, (2,0): 3, (2,2): 3,
            (0,1): 1, (1,0): 1, (1,2): 1, (2,1): 1
        }
        
        for size_idx in reversed(range(len(cones))):  # Larger cones first
            if cones[size_idx] <= 0:
                continue
            
            for r in range(3):
                for c in range(3):
                    if self.is_valid_move(board, r, c, size_idx, player):
                        priority = position_values.get((r,c), 0) + size_idx
                        moves.append((r, c, size_idx, priority))
        
        moves.sort(key=lambda x: x[3], reverse=True)
        return [(r, c, s) for r, c, s, _ in moves]

    def find_best_heuristic_move(self, board, bot_cones, player_cones):
        """Best heuristic move when minimax fails"""
        # Prefer center with large cone
        if board[1][1] is None and len(bot_cones) > 2 and bot_cones[2] > 0:
            return {"row": 1, "col": 1, "cone_size": 2}
        
        # Otherwise use medium bot's strategic move
        from bots.conquer.medium_bot import ConquerMediumBot
        medium = ConquerMediumBot()
        return medium.find_strategic_move_with_economy(board, bot_cones)

    # Helper methods from Easy bot
    def has_valid_moves(self, board, cones, player):
        """Check if player has any valid moves"""
        for size_idx in range(len(cones)):
            if cones[size_idx] <= 0:
                continue
            for r in range(3):
                for c in range(3):
                    if self.is_valid_move(board, r, c, size_idx, player):
                        return True
        return False

    def find_winning_move(self, board, cones):
        """Find immediate win"""
        for size_idx in range(len(cones)):
            if cones[size_idx] <= 0:
                continue
            for r in range(3):
                for c in range(3):
                    original = board[r][c]
                    if self.is_valid_move(board, r, c, size_idx, 2):
                        board[r][c] = {"player": 2, "size": size_idx}
                        if self.check_win(board, 2):
                            board[r][c] = original
                            return {"row": r, "col": c, "cone_size": size_idx}
                        board[r][c] = original
        return None

    def find_blocking_move(self, board, bot_cones, player_cones):
        """Block opponent win"""
        for r in range(3):
            for c in range(3):
                if board[r][c] is None or self.is_valid_move(board, r, c, 2, 2):
                    original = board[r][c]
                    board[r][c] = {"player": 1, "size": 2}
                    if self.check_win(board, 1):
                        board[r][c] = original
                        for size_idx in [2, 1, 0]:
                            if size_idx < len(bot_cones) and bot_cones[size_idx] > 0:
                                if self.is_valid_move(board, r, c, size_idx, 2):
                                    return {"row": r, "col": c, "cone_size": size_idx}
                    board[r][c] = original
        return None

    def is_valid_move(self, board, r, c, size, player=2):
        """Validate move"""
        cell = board[r][c]
        if cell is None:
            return True
        if cell['player'] == player:
            return False
        return size > cell['size']

    def check_win(self, board, player):
        """Check win"""
        for i in range(3):
            if all(board[i][j] and board[i][j]['player'] == player for j in range(3)): 
                return True
            if all(board[j][i] and board[j][i]['player'] == player for j in range(3)): 
                return True
        if all(board[i][i] and board[i][i]['player'] == player for i in range(3)): 
            return True
        if all(board[i][2-i] and board[i][2-i]['player'] == player for i in range(3)): 
            return True
        return False
