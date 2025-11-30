import random
import time
from typing import Dict, Any, Optional
from core.bot_interface import IBot
from .gomoku_strategy import GomokuStrategy

class GomokuMediumBot(IBot):
    """
    Medium Gomoku bot:
    - Uses shared GomokuStrategy
    - Deeper search (Depth 4)
    - Basic VCF (Victory by Continuous Forcing)
    - Low randomness
    """
    
    def __init__(self):
        self.strategy = GomokuStrategy()
        self.max_depth = 4
        self.max_time = 4.0
        self.randomness = 0.05  # 5% chance to pick suboptimal move
        self.transposition_table = {}

    @property
    def name(self) -> str:
        return "Gomoku Medium Bot"
    
    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        board = game_state.get("board")
        if not board:
            return None
            
        board_size = len(board)
        player = 2
        
        # 1. Opening Move
        opening_move = self.strategy.get_opening_move(board, player, board_size)
        if opening_move:
            return opening_move

        # 2. Check for immediate win
        if self.strategy.check_win(board, player, board_size):
            pass

        # 3. VCF Search (Shallow)
        vcf_move = self.find_vcf_sequence(board, player, board_size, max_depth=3)
        if vcf_move:
            return vcf_move

        # 4. Minimax Search
        best_move = self.minimax_search(board, player, board_size)
        return best_move

    def minimax_search(self, board, player, board_size):
        start_time = time.time()
        self.transposition_table.clear()
        
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        if not candidates:
            return None
            
        # Score and sort moves
        scored_moves = []
        for r, c in candidates:
            board[r][c] = {"player": player, "size": 0}
            score = self.strategy.evaluate_board(board, player, board_size)
            board[r][c] = None
            scored_moves.append(((r, c), score))
        
        scored_moves.sort(key=lambda x: x[1], reverse=True)
        top_moves = [m[0] for m in scored_moves[:25]] # Top 25
        
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
            if random.random() < self.randomness and len(top_moves) > 1:
                choice = random.choice(top_moves[:2]) # Pick from top 2
                return {"row": choice[0], "col": choice[1], "cone_size": 0}
            
            choice = best_moves[0] # Best move
            return {"row": choice[0], "col": choice[1], "cone_size": 0}
            
        return None

    def minimax(self, board, depth, is_maximizing, alpha, beta, bot_player, board_size, start_time):
        if time.time() - start_time > self.max_time:
            return self.strategy.evaluate_board(board, bot_player, board_size)
            
        board_key = self.get_board_key(board, board_size)
        if board_key in self.transposition_table:
            return self.transposition_table[board_key]
        
        opponent = 1 if bot_player == 2 else 2
        current_player = bot_player if is_maximizing else opponent
        
        if self.strategy.check_win(board, 1 if current_player == 2 else 2, board_size):
            return -100000 - depth if is_maximizing else 100000 + depth
            
        if depth == 0:
            eval_score = self.strategy.evaluate_board(board, bot_player, board_size)
            self.transposition_table[board_key] = eval_score
            return eval_score
        
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        
        if is_maximizing:
            max_eval = float('-inf')
            for r, c in candidates[:12]:
                board[r][c] = {"player": bot_player, "size": 0}
                eval = self.minimax(board, depth - 1, False, alpha, beta, bot_player, board_size, start_time)
                board[r][c] = None
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            self.transposition_table[board_key] = max_eval
            return max_eval
        else:
            min_eval = float('inf')
            for r, c in candidates[:12]:
                board[r][c] = {"player": opponent, "size": 0}
                eval = self.minimax(board, depth - 1, True, alpha, beta, bot_player, board_size, start_time)
                board[r][c] = None
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            self.transposition_table[board_key] = min_eval
            return min_eval

    def find_vcf_sequence(self, board, player, board_size, depth=0, max_depth=3):
        """Basic VCF search"""
        if depth >= max_depth:
            return None
            
        opponent = 1 if player == 2 else 2
        candidates = self.strategy.generate_candidate_moves(board, board_size)
        
        # Look for forcing moves (creates 4 or open 3)
        forcing_moves = []
        for r, c in candidates:
            board[r][c] = {"player": player, "size": 0}
            score = self.strategy.evaluate_board(board, player, board_size)
            # Heuristic check for strong threat
            if score > 5000: # Creates 4 or better
                forcing_moves.append((r, c))
            board[r][c] = None
            
        for r, c in forcing_moves:
            board[r][c] = {"player": player, "size": 0}
            if self.strategy.check_win(board, player, board_size):
                board[r][c] = None
                return {"row": r, "col": c, "cone_size": 0}
                
            # Assume opponent plays best defense
            # Simplified: if opponent has forced move, play it
            # For medium bot, just check if we can win in next ply
            # (Full VCF is complex, this is "Basic VCF")
            
            board[r][c] = None
            
        return None

    def get_board_key(self, board, board_size):
        key_list = []
        for r in range(board_size):
            for c in range(board_size):
                if r < len(board) and c < len(board[r]) and board[r][c]:
                    key_list.append((r, c, board[r][c]['player']))
        return tuple(key_list)
