import random
from typing import Dict, Any, Optional, List, Tuple
from core.bot_interface import IBot

class ConquerMediumBot(IBot):
    """Medium difficulty bot for Conquer variants with cone-aware tactics"""
    
    @property
    def name(self) -> str:
        return "Conquer Medium Bot"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Medium strategy:
        - 2-move look-ahead with cone awareness
        - Cone economy (save larger cones)
        - Position scoring
        - Threat creation
        """
        board = game_state.get("board")
        bot_cones = game_state.get("bot_cones")
        player_cones = game_state.get("player_cones")
        
        if not board or not bot_cones:
            return None

        # 1. Check for immediate winning move
        winning_move = self.find_winning_move(board, bot_cones)
        if winning_move:
            return winning_move

        # 2. Block opponent's immediate winning move
        blocking_move = self.find_blocking_move(board, bot_cones, player_cones)
        if blocking_move:
            return blocking_move

        # 3. Look-ahead: Check if opponent can win in 2 moves
        two_move_block = self.find_two_move_threat(board, bot_cones, player_cones)
        if two_move_block:
            return two_move_block

        # 4. Create multi-threat position
        multi_threat = self.create_multi_threat(board, bot_cones)
        if multi_threat:
            return multi_threat

        # 5. Strategic position with cone economy
        strategic_move = self.find_strategic_move_with_economy(board, bot_cones)
        if strategic_move:
            return strategic_move

        # 6. Fallback: random valid move
        return self.get_random_move(board, bot_cones)

    def find_two_move_threat(self, board, bot_cones, player_cones):
        """
        Look 2 moves ahead: If opponent can create a winning position next turn,
        block it preemptively
        """
        opponent_player = 1  # Opponent is player 1
        
        # Try all opponent's possible moves
        for opp_size in range(len(player_cones)):
            if player_cones[opp_size] <= 0:
                continue
            
            for r in range(3):
                for c in range(3):
                    if not self.is_valid_move(board, r, c, opp_size, opponent_player):
                        continue
                    
                    # Simulate opponent's move
                    original = board[r][c]
                    board[r][c] = {"player": opponent_player, "size": opp_size}
                    temp_player_cones = player_cones.copy()
                    if temp_player_cones[opp_size] < 900:
                        temp_player_cones[opp_size] -= 1
                    
                    # Check if opponent can win on next move
                    opp_winning_move = self.find_winning_move_for_player(board, temp_player_cones, opponent_player)
                    
                    board[r][c] = original
                    
                    if opp_winning_move:
                        # Block this setup move
                        # Try to block with smallest effective cone
                        for size_idx in [0, 1, 2]:
                            if size_idx < len(bot_cones) and bot_cones[size_idx] > 0:
                                if self.is_valid_move(board, r, c, size_idx, 2):
                                    return {"row": r, "col": c, "cone_size": size_idx}
        
        return None

    def create_multi_threat(self, board, bot_cones):
        """
        Find move that creates multiple winning paths
        (positions with 2+ ways to win)
        """
        best_move = None
        best_threat_count = 0
        
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
                    
                    # Count how many lines have 2 pieces of ours
                    threat_count = self.count_two_in_line_positions(board, 2)
                    
                    board[r][c] = original
                    
                    if threat_count > best_threat_count:
                        best_threat_count = threat_count
                        best_move = {"row": r, "col": c, "cone_size": size_idx}
        
        # Only return if we found a good multi-threat position
        if best_threat_count >= 2:
            return best_move
        
        return None

    def count_two_in_line_positions(self, board, player):
        """Count how many lines have exactly 2 of our pieces"""
        lines = [
            # Rows
            [(0,0), (0,1), (0,2)], [(1,0), (1,1), (1,2)], [(2,0), (2,1), (2,2)],
            # Columns
            [(0,0), (1,0), (2,0)], [(0,1), (1,1), (2,1)], [(0,2), (1,2), (2,2)],
            # Diagonals
            [(0,0), (1,1), (2,2)], [(0,2), (1,1), (2,0)]
        ]
        
        count = 0
        for line in lines:
            our_pieces = sum(1 for r, c in line if board[r][c] and board[r][c]['player'] == player)
            opponent_pieces = sum(1 for r, c in line if board[r][c] and board[r][c]['player'] != player)
            
            # Line with 2 of ours and no opponent pieces = threat
            if our_pieces == 2 and opponent_pieces == 0:
                count += 1
        
        return count

    def find_strategic_move_with_economy(self, board, bot_cones):
        """
        Find best strategic move using:
        - Position values (center > corners > edges)
        - Cone economy (prefer smaller cones when possible)
        """
        position_values = {
            (1,1): 5,  # Center
            (0,0): 3, (0,2): 3, (2,0): 3, (2,2): 3,  # Corners
            (0,1): 1, (1,0): 1, (1,2): 1, (2,1): 1   # Edges
        }
        
        best_move = None
        best_score = -1
        
        # Prefer smaller cones to save larger ones
        cone_preference = [0, 1, 2]  # Small, medium, large
        
        for size_idx in cone_preference:
            if size_idx >= len(bot_cones) or bot_cones[size_idx] <= 0:
                continue
            
            for r in range(3):
                for c in range(3):
                    if not self.is_valid_move(board, r, c, size_idx, 2):
                        continue
                    
                    # Calculate score
                    pos_value = position_values.get((r, c), 0)
                    
                    # Bonus for smaller cones (cone economy)
                    economy_bonus = (2 - size_idx) * 2
                    
                    # Bonus for blocking opponent setup
                    board[r][c] = {"player": 2, "size": size_idx}
                    blocks_opponent = 1 if self.blocks_opponent_threat(board, r, c) else 0
                    board[r][c] = None
                    
                    total_score = pos_value + economy_bonus + (blocks_opponent * 10)
                    
                    if total_score > best_score:
                        best_score = total_score
                        best_move = {"row": r, "col": c, "cone_size": size_idx}
        
        return best_move if best_score > 0 else None

    def blocks_opponent_threat(self, board, r, c):
        """Check if current board position blocks opponent's threat"""
        # Check all lines containing (r,c)
        lines_with_pos = self.get_lines_containing(r, c)
        
        for line in lines_with_pos:
            opponent_count = sum(1 for lr, lc in line if board[lr][lc] and board[lr][lc]['player'] == 1)
            our_count = sum(1 for lr, lc in line if board[lr][lc] and board[lr][lc]['player'] == 2)
            
            # We blocked a line where opponent had 2 pieces
            if opponent_count >= 2 and our_count >= 1:
                return True
        
        return False

    def get_lines_containing(self, r, c):
        """Get all lines containing position (r,c)"""
        all_lines = [
            # Rows
            [(0,0), (0,1), (0,2)], [(1,0), (1,1), (1,2)], [(2,0), (2,1), (2,2)],
            # Columns
            [(0,0), (1,0), (2,0)], [(0,1), (1,1), (2,1)], [(0,2), (1,2), (2,2)],
            # Diagonals
            [(0,0), (1,1), (2,2)], [(0,2), (1,1), (2,0)]
        ]
        
        return [line for line in all_lines if (r, c) in line]

    def find_winning_move(self, board, cones):
        """Find immediate winning move (from Easy bot)"""
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

    def find_winning_move_for_player(self, board, cones, player):
        """Find winning move for specific player"""
        for size_idx in range(len(cones)):
            if cones[size_idx] <= 0:
                continue
            for r in range(3):
                for c in range(3):
                    original = board[r][c]
                    if self.is_valid_move(board, r, c, size_idx, player):
                        board[r][c] = {"player": player, "size": size_idx}
                        if self.check_win(board, player):
                            board[r][c] = original
                            return {"row": r, "col": c, "cone_size": size_idx}
                        board[r][c] = original
        return None

    def find_blocking_move(self, board, bot_cones, player_cones):
        """Block opponent's winning move (from Easy bot)"""
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

    def get_random_move(self, board, cones):
        """Get random valid move (from Easy bot)"""
        valid_moves = []
        for size_idx in range(len(cones)):
            if cones[size_idx] <= 0:
                continue
            for r in range(3):
                for c in range(3):
                    if self.is_valid_move(board, r, c, size_idx, 2):
                        valid_moves.append({"row": r, "col": c, "cone_size": size_idx})
        
        if not valid_moves:
            return None
        return random.choice(valid_moves)

    def is_valid_move(self, board, r, c, size, player=2):
        """Check if move is valid (from Easy bot)"""
        cell = board[r][c]
        if cell is None:
            return True
        if cell['player'] == player:
            return False
        return size > cell['size']

    def check_win(self, board, player):
        """Check win condition (from Easy bot)"""
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
