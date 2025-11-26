import random
import copy

class ClassicTicTacToeBot:
    """Simple Minimax-based bot for Classic Tic-Tac-Toe"""
    
    def get_move(self, board, player=2):
        """
        Get best move for Classic Tic-Tac-Toe using Minimax algorithm
        board: 3x3 array where each cell is None or {"player": 1 or 2, "size": 0}
        Returns: {"row": r, "col": c, "cone_size": 0}
        """
        best_score = float('-inf')
        best_move = None
        
        for r in range(3):
            for c in range(3):
                if board[r][c] is None:
                    # Try this move
                    board[r][c] = {"player": player, "size": 0}
                    score = self.minimax(board, 0, False, player)
                    board[r][c] = None
                    
                    if score > best_score:
                        best_score = score
                        best_move = {"row": r, "col": c, "cone_size": 0}
        
        return best_move if best_move else self.get_random_move(board)
    
    def minimax(self, board, depth, is_maximizing, bot_player):
        """Minimax algorithm implementation"""
        opponent = 1 if bot_player == 2 else 2
        
        # Check terminal states
        if self.check_win(board, bot_player):
            return 10 - depth
        if self.check_win(board, opponent):
            return depth - 10
        if self.is_full(board):
            return 0
        
        if is_maximizing:
            best_score = float('-inf')
            for r in range(3):
                for c in range(3):
                    if board[r][c] is None:
                        board[r][c] = {"player": bot_player, "size": 0}
                        score = self.minimax(board, depth + 1, False, bot_player)
                        board[r][c] = None
                        best_score = max(score, best_score)
            return best_score
        else:
            best_score = float('inf')
            for r in range(3):
                for c in range(3):
                    if board[r][c] is None:
                        board[r][c] = {"player": opponent, "size": 0}
                        score = self.minimax(board, depth + 1, True, bot_player)
                        board[r][c] = None
                        best_score = min(score, best_score)
            return best_score
    
    def check_win(self, board, player):
        """Check if player has won"""
        # Rows and columns
        for i in range(3):
            if all(board[i][j] and board[i][j]['player'] == player for j in range(3)):
                return True
            if all(board[j][i] and board[j][i]['player'] == player for j in range(3)):
                return True
        # Diagonals
        if all(board[i][i] and board[i][i]['player'] == player for i in range(3)):
            return True
        if all(board[i][2-i] and board[i][2-i]['player'] == player for i in range(3)):
            return True
        return False
    
    def is_full(self, board):
        """Check if board is full"""
        return all(board[r][c] is not None for r in range(3) for c in range(3))
    
    def get_random_move(self, board):
        """Fallback random move"""
        valid_moves = [(r, c) for r in range(3) for c in range(3) if board[r][c] is None]
        if valid_moves:
            r, c = random.choice(valid_moves)
            return {"row": r, "col": c, "cone_size": 0}
        return None


class GomokuBot:
    """Pattern-based bot for Gomoku (5-in-a-row)"""
    
    def get_move(self, board, player=2, board_size=15):
        """
        Get move for Gomoku using pattern recognition
        board: NxN array where each cell is None or {"player": 1 or 2, "size": 0}
        Returns: {"row": r, "col": c, "cone_size": 0}
        """
        # CRITICAL: Use actual board dimensions, not the parameter
        # (parameter might not match actual board size)
        actual_board_size = len(board) if board else board_size
        
        # 1. Check for immediate win
        winning_move = self.find_winning_move(board, player, actual_board_size)
        if winning_move:
            return winning_move
        
        # 2. Block opponent's four-in-a-row
        opponent = 1 if player == 2 else 2
        blocking_move = self.find_winning_move(board, opponent, actual_board_size)
        if blocking_move:
            return blocking_move
        
        # 3. Look for strategic positions (near existing pieces)
        strategic_move = self.find_strategic_move(board, player, actual_board_size)
        if strategic_move:
            return strategic_move
        
        # 4. Take center or nearby if available
        center = actual_board_size // 2
        for offset in range(3):
            for dr in [-offset, 0, offset]:
                for dc in [-offset, 0, offset]:
                    r, c = center + dr, center + dc
                    if 0 <= r < actual_board_size and 0 <= c < actual_board_size and board[r][c] is None:
                        return {"row": r, "col": c, "cone_size": 0}
        
        # 5. Random move
        return self.get_random_move(board, actual_board_size)
    
    def find_winning_move(self, board, player, board_size):
        """Find move that creates 5-in-a-row"""
        # CRITICAL: Use actual board dimensions
        actual_size = min(board_size, len(board) if board else board_size)
        for r in range(actual_size):
            for c in range(actual_size):
                # Additional safety check
                if r >= len(board) or c >= len(board[r]):
                    continue
                if board[r][c] is None:
                    # Try this move
                    board[r][c] = {"player": player, "size": 0}
                    if self.check_win(board, player, r, c, board_size):
                        board[r][c] = None
                        return {"row": r, "col": c, "cone_size": 0}
                    board[r][c] = None
        return None
    
    def find_strategic_move(self, board, player, board_size):
        """Find move near existing pieces"""
        best_score = -1
        best_move = None
        
        for r in range(board_size):
            for c in range(board_size):
                if board[r][c] is None:
                    score = self.evaluate_position(board, r, c, player, board_size)
                    if score > best_score:
                        best_score = score
                        best_move = {"row": r, "col": c, "cone_size": 0}
        
        return best_move if best_score > 0 else None
    
    def evaluate_position(self, board, r, c, player, board_size):
        """Evaluate how good a position is"""
        score = 0
        # Count friendly and enemy pieces nearby
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if 0 <= nr < board_size and 0 <= nc < board_size:
                    if board[nr][nc] and board[nr][nc]['player'] == player:
                        score += 2
                    elif board[nr][nc]:
                        score += 1
        return score
    
    def check_win(self, board, player, r, c, board_size):
        """Check if placing at (r,c) creates 5-in-a-row"""
        directions = [(0,1), (1,0), (1,1), (1,-1)] # Check in all 4 directions from this position
        
        for dr, dc in directions:
            count = 1  # Count current stone
            # Check in positive direction
            for i in range(1, 5):
                nr, nc = r + dr*i, c + dc*i
                # CRITICAL: Add bounds check
                if nr < 0 or nr >= board_size or nc < 0 or nc >= board_size:
                    break
                if board[nr][nc] and board[nr][nc]['player'] == player:
                    count += 1
                else:
                    break
            # Check in negative direction
            for i in range(1, 5):
                nr, nc = r - dr*i, c - dc*i
                # CRITICAL: Add bounds check
                if nr < 0 or nr >= board_size or nc < 0 or nc >= board_size:
                    break
                if board[nr][nc] and board[nr][nc]['player'] == player:
                    count += 1
                else:
                    break
            
            if count >= 5:
                return True
        return False
    
    def get_random_move(self, board, board_size):
        """Fallback random move"""
        valid_moves = [(r, c) for r in range(board_size) for c in range(board_size) 
                      if board[r][c] is None]
        if valid_moves:
            r, c = random.choice(valid_moves)
            return {"row": r, "col": c, "cone_size": 0}
        return None


class HeuristicBot:
    """Existing bot for Conquer-Tac-Toe variants"""
    def __init__(self):
        pass

    def get_move(self, board, player_cones, bot_cones, difficulty="medium"):
        """
        Determines the best move based on the current board state and difficulty.
        """
        # 1. Check for winning move
        winning_move = self.find_winning_move(board, bot_cones)
        if winning_move:
            return winning_move

        # 2. Block opponent's winning move
        blocking_move = self.find_blocking_move(board, bot_cones)
        if blocking_move:
            return blocking_move

        # 3. Take center if available (and we have a large cone)
        if board[1][1] is None and bot_cones[2] > 0:
            return {"row": 1, "col": 1, "cone_size": 2}

        # 4. Random valid move
        return self.get_random_move(board, bot_cones)

    def find_winning_move(self, board, cones):
        for size_idx in range(len(cones)):
            # CRITICAL: Only try this cone size if we actually have it available
            if cones[size_idx] <= 0:
                continue
                
            for r in range(3):
                for c in range(3):
                    # Save original state BEFORE checking validity
                    original = board[r][c]
                    if self.is_valid_move(board, r, c, size_idx):
                        board[r][c] = {"player": 2, "size": size_idx}
                        if self.check_win(board, 2):
                            board[r][c] = original
                            return {"row": r, "col": c, "cone_size": size_idx}
                        board[r][c] = original
        return None

    def find_blocking_move(self, board, bot_cones):
        """Find a move to block opponent's winning move using bot's available cones"""
        # First, find where opponent could win
        for r in range(3):
            for c in range(3):
                if board[r][c] is None or self.is_valid_move(board, r, c, 2):  # Check if we can play here
                    original = board[r][c]
                    # Test if opponent placing here would win
                    board[r][c] = {"player": 1, "size": 2}  # Assume largest cone
                    if self.check_win(board, 1):
                        board[r][c] = original
                        # Find best cone size we have available to block this spot
                        for size_idx in [2, 1, 0]:  # Prefer larger cones
                            if bot_cones[size_idx] > 0 and self.is_valid_move(board, r, c, size_idx):
                                return {"row": r, "col": c, "cone_size": size_idx}
                    board[r][c] = original
        return None

    def get_random_move(self, board, cones):
        valid_moves = []
        # IMPORTANT: Only consider cones that are actually available (count > 0)
        for size_idx in range(len(cones)):
            # Skip if no cones of this size available
            if cones[size_idx] <= 0:
                continue
                
            for r in range(3):
                for c in range(3):
                    if self.is_valid_move(board, r, c, size_idx):
                        valid_moves.append({"row": r, "col": c, "cone_size": size_idx})
        
        if not valid_moves:
            return None
        return random.choice(valid_moves)

    def is_valid_move(self, board, r, c, size):
        """Check if a move is valid.
        
        Rules:
        - Empty cell is always valid
        - Can only overwrite opponent's cones (not your own)
        - Must use a larger cone to overwrite
        """
        cell = board[r][c]
        if cell is None:
            return True
        
        # Cannot overwrite your own cones (bot is player 2)
        if cell['player'] == 2:
            return False
            
        # Can only overwrite with strictly larger cone
        return size > cell['size']

    def find_best_cone_for_spot(self, board, r, c):
        return 2  # Placeholder

    def check_win(self, board, player):
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
