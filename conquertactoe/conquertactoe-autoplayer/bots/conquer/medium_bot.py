import random
from typing import Dict, Any, Optional, List
from core.bot_interface import IBot
from .conquer_strategy import ConquerStrategy

class ConquerMediumBot(IBot):
    """
    Medium difficulty bot for Conquer variants.
    - Uses shared ConquerStrategy
    - Minimax Search (Depth 4)
    - Cone Economy awareness
    """
    
    def __init__(self):
        self.strategy = ConquerStrategy()
        self.max_depth = 4
        
    @property
    def name(self) -> str:
        return "Conquer Medium Bot"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        board = game_state.get("board")
        bot_cones = game_state.get("bot_cones")
        player_cones = game_state.get("player_cones")
        
        if not board or not bot_cones:
            return None

        # Run Minimax
        best_move = self.minimax_search(board, bot_cones, player_cones)
        
        if best_move:
            return best_move
            
        # Fallback
        return self.strategy.get_random_move(board, bot_cones, 2)

    def minimax_search(self, board, bot_cones, player_cones):
        best_score = float('-inf')
        best_move = None
        
        # Generate moves
        moves = self.strategy.generate_valid_moves(board, bot_cones, 2)
        
        # Shuffle for variety in equal positions
        random.shuffle(moves)
        
        for move in moves:
            r, c, size = move['row'], move['col'], move['cone_size']
            
            # Simulate
            original = board[r][c]
            board[r][c] = {"player": 2, "size": size}
            new_bot_cones = bot_cones.copy()
            if new_bot_cones[size] < 900: # 900 is infinite
                new_bot_cones[size] -= 1
                
            # Score
            score = self.minimax(board, new_bot_cones, player_cones, self.max_depth - 1, False)
            
            # Undo
            board[r][c] = original
            
            if score > best_score:
                best_score = score
                best_move = move
                
        return best_move

    def minimax(self, board, bot_cones, player_cones, depth, is_maximizing):
        # Terminal checks
        if self.strategy.check_win(board, 2):
            return 1000 + depth
        if self.strategy.check_win(board, 1):
            return -1000 - depth
        
        if depth == 0:
            return self.strategy.evaluate_board(board, 2, bot_cones, player_cones)
            
        if is_maximizing:
            max_eval = float('-inf')
            moves = self.strategy.generate_valid_moves(board, bot_cones, 2)
            
            if not moves: # No moves = Draw/Loss depending on rules, usually just pass/end
                return 0
                
            for move in moves:
                r, c, size = move['row'], move['col'], move['cone_size']
                original = board[r][c]
                board[r][c] = {"player": 2, "size": size}
                new_bot_cones = bot_cones.copy()
                if new_bot_cones[size] < 900:
                    new_bot_cones[size] -= 1
                    
                eval = self.minimax(board, new_bot_cones, player_cones, depth - 1, False)
                
                board[r][c] = original
                max_eval = max(max_eval, eval)
            return max_eval
        else:
            min_eval = float('inf')
            moves = self.strategy.generate_valid_moves(board, player_cones, 1)
            
            if not moves:
                return 0
                
            for move in moves:
                r, c, size = move['row'], move['col'], move['cone_size']
                original = board[r][c]
                board[r][c] = {"player": 1, "size": size}
                new_player_cones = player_cones.copy()
                if new_player_cones[size] < 900:
                    new_player_cones[size] -= 1
                    
                eval = self.minimax(board, bot_cones, new_player_cones, depth - 1, True)
                
                board[r][c] = original
                min_eval = min(min_eval, eval)
            return min_eval
