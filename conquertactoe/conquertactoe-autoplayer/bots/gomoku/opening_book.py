"""
Gomoku Opening Book
Stores proven opening moves for first 3-5 moves of the game.
"""

# Opening book: Dictionary mapping board states to best responses
# Format: board_hash -> (row, col, description)

GOMOKU_OPENINGS = {
    # First move (always center for various board sizes)
    'empty_10': (5, 5, "Center opening for 10x10"),
    'empty_12': (6, 6, "Center opening for 12x12"),
    'empty_15': (7, 7, "Center opening for 15x15"),
    'empty_19': (9, 9, "Center opening for 19x19"),
    
    # Standard defensive responses when opponent takes center
    # These are relative to center position
    'opponent_center_diagonal': (1, 1, "Diagonal defense (strongest)"),
    'opponent_center_knight': (2, 1, "Knight move defense"),
    
    # Common opening patterns (named openings)
    'direct_opening': {
        'desc': "Direct opening - center + diagonal",
        'moves': [(7, 7), (8, 8), (6, 9)]
    },
    
    'indirect_opening': {
        'desc': "Indirect opening - center + knight's move",
        'moves': [(7, 7), (9, 8), (7, 10)]
    },
    
    'soosyrv_8': {
        'desc': "Soosyrv-8 balanced opening",
        'moves': [(7, 7), (8, 6), (9, 8), (6, 6)]
    },
}

# Pattern-based responses
DEFENSIVE_PATTERNS = {
    'center_occupied': [
        # Try diagonal first
        (1, 1), (-1, 1), (-1, -1), (1, -1),
        # Knight's move as backup
        (2, 1), (1, 2), (-1, 2), (-2, 1), (-2, -1), (-1, -2), (1, -2), (2, -1)
    ],
    
    'off_center': [
        # Take center if available
        (0, 0)
    ]
}

def get_opening_move(board, board_size, player):
    """
    Get opening move from book if applicable.
    
    Args:
        board: Current board state
        board_size: Size of the board
        player: Player number (1 or 2)
    
    Returns:
        (row, col) or None if not in opening book
    """
    center = board_size // 2
    piece_count = sum(1 for r in range(board_size) for c in range(board_size) 
                     if board[r][c] is not None)
    
    # First move - always center
    if piece_count == 0:
        return (center, center)
    
    # Second move - check opponent's first move
    elif piece_count == 1:
        if board[center][center] is not None:
            # Opponent took center - use defensive pattern
            for dr, dc in DEFENSIVE_PATTERNS['center_occupied']:
                r, c = center + dr, center + dc
                if 0 <= r < board_size and 0 <= c < board_size and board[r][c] is None:
                    return (r, c)
        else:
            # Opponent played off-center - take center
            return (center, center)
    
    # Moves 3-4: Pattern-based
    # This would require more complex pattern matching
    return None

def board_matches_pattern(board, pattern_moves, center):
    """
    Check if current board matches a known opening pattern.
    """
    for i, (expected_r, expected_c) in enumerate(pattern_moves):
        # Adjust for board center
        actual_r = center + (expected_r - 7)  # Assuming 15x15 reference
        actual_c = center + (expected_c - 7)
        
        if board[actual_r][actual_c] is None:
            return False
    
    return True
