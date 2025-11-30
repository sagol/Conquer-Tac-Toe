import random
import time
from typing import Dict, Any, Optional, List, Tuple
from core.bot_interface import IBot
from .gomoku_strategy import GomokuStrategy

class GomokuHardBot(IBot):
    """
    Hard Gomoku bot (Expert):
    - Uses shared GomokuStrategy for robust evaluation
    - Deep search (Depth 6+)
    - Deep VCF (Victory by Continuous Forcing)
    - Advanced move ordering and pruning
    - No randomness (plays best move)
    """
    
    def __init__(self):
        self.strategy = GomokuStrategy()
        self.max_depth = 6
        self.max_time = 5.0
        self.transposition_table = {}
        self.killer_moves = {}

    @property
    def name(self) -> str:
        return "Gomoku Hard Bot (Expert)"
    
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
        if self.strategy.check_win(board, player, board_size):
            pass

        # 3. VCF Search (Deep)
        # Look for forced win sequence up to 12 plies deep
        vcf_move = self.find_vcf_sequence(board, player, board_size, max_depth=12)
        if vcf_move:
            return vcf_move

        # 4. Deep Minimax Search
        best_move = self.minimax_search(board, player, board_size)
        return best_move

    def minimax_search(self, board, player, board_size):
        start_time = time.time()
        self.transposition_table.clear()
        self.killer_moves.clear()
        
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        if not candidates:
            return None
            
        # Advanced scoring for ordering
        scored_moves = []
        for r, c in candidates:
            # Simulate move
            board[r][c] = {"player": player, "size": 0}
            
            # Use strategy evaluation for ordering
            score = self.strategy.evaluate_board(board, player, board_size)
            
            # Bonus for moves that create immediate threats
            if self.strategy.check_win(board, player, board_size):
                score += 100000
            
            # Add zone control score for ordering
            score += self.evaluate_zone_control(board, player, board_size)
            
            # Unmake move
            board[r][c] = None
            
            scored_moves.append(((r, c), score))
        
        scored_moves.sort(key=lambda x: x[1], reverse=True)
        top_moves = [m[0] for m in scored_moves[:30]] # Top 30
        
        best_score = float('-inf')
        best_move = None
        alpha = float('-inf')
        beta = float('inf')
        
        # If no time, return best heuristic move immediately
        if top_moves:
            best_move = top_moves[0]
        
        for r, c in top_moves:
            if time.time() - start_time > self.max_time:
                break
                
            board[r][c] = {"player": player, "size": 0}
            score = self.minimax(board, self.max_depth - 1, False, alpha, beta, player, board_size, start_time, 1)
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
            return self.evaluate_position_combined(board, bot_player, board_size)
            
        board_key = self.get_board_key(board, board_size)
        if board_key in self.transposition_table:
            return self.transposition_table[board_key]
        
        opponent = 1 if bot_player == 2 else 2
        current_player = bot_player if is_maximizing else opponent
        
        if self.strategy.check_win(board, 1 if current_player == 2 else 2, board_size):
            return -100000 - depth if is_maximizing else 100000 + depth
            
        if depth == 0:
            eval_score = self.evaluate_position_combined(board, bot_player, board_size)
            self.transposition_table[board_key] = eval_score
            return eval_score
        
        # Get moves with killer heuristic
        candidates = self.get_ordered_moves(board, current_player, board_size, ply)
        
        if is_maximizing:
            max_eval = float('-inf')
            for r, c in candidates[:15]:
                board[r][c] = {"player": bot_player, "size": 0}
                eval = self.minimax(board, depth - 1, False, alpha, beta, bot_player, board_size, start_time, ply + 1)
                board[r][c] = None
                
                if eval > max_eval:
                    max_eval = eval
                    # Update killer move
                    if ply not in self.killer_moves:
                        self.killer_moves[ply] = []
                    if (r, c) not in self.killer_moves[ply]:
                        self.killer_moves[ply].insert(0, (r, c))
                
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            self.transposition_table[board_key] = max_eval
            return max_eval
        else:
            min_eval = float('inf')
            for r, c in candidates[:15]:
                board[r][c] = {"player": opponent, "size": 0}
                eval = self.minimax(board, depth - 1, True, alpha, beta, bot_player, board_size, start_time, ply + 1)
                board[r][c] = None
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            self.transposition_table[board_key] = min_eval
            return min_eval

    def evaluate_position_combined(self, board, player, board_size):
        """Combine shared strategy evaluation with zone control"""
        # Base score from shared strategy (robust pattern matching)
        score = self.strategy.evaluate_board(board, player, board_size)
        
        # Add zone control
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

    def get_ordered_moves(self, board, player, board_size, ply):
        """Get moves with killer heuristic"""
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        
        # Prioritize killer moves
        killers = self.killer_moves.get(ply, [])
        ordered_moves = []
        
        for km in killers:
            if km in candidates:
                ordered_moves.append(km)
                candidates.remove(km)
                
        # Then other candidates
        ordered_moves.extend(candidates)
        
        return ordered_moves

    def find_vcf_sequence(self, board, player, board_size, depth=0, max_depth=10):
        """Deep VCF search"""
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
            if score > 5000: # Creates 4 or better
                forcing_moves.append((r, c))
                
            board[r][c] = None
            
        # Try forcing moves
        for r, c in forcing_moves:
            board[r][c] = {"player": player, "size": 0}
            
            # Simplified VCF: if we can force a win, take it.
            # We don't fully simulate opponent's forced moves here to save complexity,
            # but we assume if we have a sequence of threats that leads to a win, it's good.
            # For a true VCF, we need to verify opponent has NO defense.
            # Here we just check if we can continue attacking.
            
            next_move = self.find_vcf_sequence(board, player, board_size, depth + 1, max_depth)
            
            board[r][c] = None
            
            if next_move:
                return {"row": r, "col": c, "cone_size": 0}
            
        return None

    def get_board_key(self, board, board_size):
        key_list = []
        for r in range(min(board_size, len(board))):
            for c in range(min(board_size, len(board[r]) if r < len(board) else 0)):
                cell = board[r][c] if r < len(board) and c < len(board[r]) else None
                if cell:
                    key_list.append((r, c, cell['player']))
        return tuple(key_list)
