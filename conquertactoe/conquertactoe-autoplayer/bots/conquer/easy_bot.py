import random
from typing import Dict, Any, Optional
from core.bot_interface import IBot
from .conquer_strategy import ConquerStrategy

class ConquerEasyBot(IBot):
    """
    Easy difficulty bot for Conquer variants.
    - Uses shared ConquerStrategy
    - 1-ply search (Win/Block)
    - High randomness
    """
    
    def __init__(self):
        self.strategy = ConquerStrategy()
        
    @property
    def name(self) -> str:
        return "Conquer Easy Bot"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        board = game_state.get("board")
        bot_cones = game_state.get("bot_cones")
        
        if not board or not bot_cones:
            return None

        # 1. Check for winning move
        winning_move = self.find_winning_move(board, bot_cones)
        if winning_move:
            return winning_move

        # 2. Block opponent's winning move (sometimes misses it for "easy" difficulty)
        if random.random() > 0.2: # 20% chance to miss a block
            blocking_move = self.find_blocking_move(board, bot_cones)
            if blocking_move:
                return blocking_move

        # 3. Take center if available (and we have a large cone)
        if board[1][1] is None and len(bot_cones) > 2 and bot_cones[2] > 0:
            return {"row": 1, "col": 1, "cone_size": 2}

        # 4. Random valid move
        return self.strategy.get_random_move(board, bot_cones, 2)

    def find_winning_move(self, board, cones):
        """Find immediate winning move"""
        moves = self.strategy.generate_valid_moves(board, cones, 2)
        for move in moves:
            r, c, size = move['row'], move['col'], move['cone_size']
            
            # Try move
            original = board[r][c]
            board[r][c] = {"player": 2, "size": size}
            
            if self.strategy.check_win(board, 2):
                board[r][c] = original
                return move
                
            board[r][c] = original
        return None

    def find_blocking_move(self, board, bot_cones):
        """Find a move to block opponent's winning move"""
        # Check where opponent could win
        # We assume opponent has all cone sizes available for this check to be safe
        # or we could pass player_cones if we had them. 
        # For easy bot, checking if they can win with a large cone is a good heuristic.
        
        for r in range(3):
            for c in range(3):
                # If opponent plays here with max size, do they win?
                # We check if it's a valid move for them first (e.g. not their own piece)
                if self.strategy.is_valid_move(board, r, c, 2, 1):
                    original = board[r][c]
                    board[r][c] = {"player": 1, "size": 2}
                    
                    if self.strategy.check_win(board, 1):
                        # They win here! We must block.
                        board[r][c] = original
                        
                        # Find best cone size we have to take this spot
                        # We need to overwrite whatever is there (if anything)
                        # or just place if empty.
                        # Since we are blocking a potential move, we just need to occupy this square 
                        # with something that prevents them from winning immediately OR 
                        # just taking the spot is often enough if it's empty.
                        
                        # BUT, if they win by overwriting US, we can't block by just being there.
                        # We need to make sure we occupy it with a size they can't overwrite?
                        # Or just occupy it so they can't place?
                        
                        # Simplest block: Take the spot if we can.
                        for size_idx in [2, 1, 0]: # Prefer larger
                            if size_idx < len(bot_cones) and bot_cones[size_idx] > 0:
                                if self.strategy.is_valid_move(board, r, c, size_idx, 2):
                                    return {"row": r, "col": c, "cone_size": size_idx}
                                    
                    board[r][c] = original
        return None
