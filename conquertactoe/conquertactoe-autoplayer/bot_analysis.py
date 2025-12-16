#!/usr/bin/env python3
"""
Comprehensive Bot vs Bot Simulation and Analysis
This script runs multiple games and analyzes:
1. Pattern recognition accuracy
2. Blocking behavior
3. Proactive play (building own patterns)
4. Win/loss rates
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from bots.gomoku.hard_bot import GomokuHardBot
from bots.gomoku.gomoku_strategy import GomokuStrategy


def print_board(board, size=15):
    """Print the board in a readable format."""
    print("   " + " ".join(f"{i:2}" for i in range(size)))
    for r in range(size):
        row_str = f"{r:2} "
        for c in range(size):
            cell = board[r][c]
            if cell is None:
                row_str += " . "
            elif cell['player'] == 1:
                row_str += " X "
            else:
                row_str += " O "
        print(row_str)
    print()


def analyze_threats(board, player, strategy, size):
    """Analyze threats on the board."""
    candidates = strategy.generate_candidate_moves(board, size)
    
    # Check for winning moves
    winning_moves = []
    for r, c in candidates:
        if board[r][c] is None:
            board[r][c] = {'player': player, 'size': 0}
            if strategy.check_win(board, player, size):
                winning_moves.append((r, c))
            board[r][c] = None
    
    # Check for must-block moves
    opponent = 1 if player == 2 else 2
    must_block = []
    for r, c in candidates:
        if board[r][c] is None:
            board[r][c] = {'player': opponent, 'size': 0}
            if strategy.check_win(board, opponent, size):
                must_block.append((r, c))
            board[r][c] = None
    
    return winning_moves, must_block


def count_patterns(board, player, size):
    """Count connected pieces for a player."""
    max_horizontal = 0
    max_vertical = 0
    max_diag1 = 0
    max_diag2 = 0
    
    # Horizontal
    for r in range(size):
        count = 0
        for c in range(size):
            if board[r][c] and board[r][c]['player'] == player:
                count += 1
                max_horizontal = max(max_horizontal, count)
            else:
                count = 0
    
    # Vertical
    for c in range(size):
        count = 0
        for r in range(size):
            if board[r][c] and board[r][c]['player'] == player:
                count += 1
                max_vertical = max(max_vertical, count)
            else:
                count = 0
    
    # Diagonals (simplified)
    for start in range(size):
        # Down-right
        count = 0
        r, c = start, 0
        while r < size and c < size:
            if board[r][c] and board[r][c]['player'] == player:
                count += 1
                max_diag1 = max(max_diag1, count)
            else:
                count = 0
            r += 1
            c += 1
    
    return max(max_horizontal, max_vertical, max_diag1, max_diag2)


def run_game(bot1, bot2, verbose=True):
    """Run a single game between two bots."""
    size = 15
    board = [[None for _ in range(size)] for _ in range(size)]
    strategy = GomokuStrategy()
    
    current_player = 1  # Player 1 (X) starts
    bots = {1: bot1, 2: bot2}
    move_history = []
    
    for move_num in range(225):  # Max moves on 15x15 board
        bot = bots[current_player]
        
        game_state = {
            'board': board,
            'player_cones': [999],
            'bot_cones': [999],
            'difficulty': 'hard',
            'variant_id': 2,
            'board_size': size
        }
        
        # Analyze before move
        winning, must_block = analyze_threats(board, current_player, strategy, size)
        
        move = bot.get_move(game_state)
        
        if not move:
            if verbose:
                print(f"Player {current_player} has no moves - DRAW")
            return 0, move_history
        
        r, c = move['row'], move['col']
        
        # Check for mistakes
        mistake = None
        if must_block and (r, c) not in must_block:
            mistake = f"FAILED TO BLOCK at {must_block[0]}"
        elif winning and (r, c) not in winning:
            mistake = f"MISSED WIN at {winning[0]}"
        
        move_history.append({
            'player': current_player,
            'move': (r, c),
            'winning_moves': winning,
            'must_block': must_block,
            'mistake': mistake
        })
        
        if verbose and mistake:
            print(f"Move {move_num+1}: Player {current_player} played ({r},{c}) - {mistake}")
        
        # Make the move
        board[r][c] = {'player': current_player, 'size': 0}
        
        # Check for win
        if strategy.check_win(board, current_player, size):
            if verbose:
                print(f"\nPlayer {current_player} WINS after {move_num+1} moves!")
                print_board(board, size)
            return current_player, move_history
        
        # Switch player
        current_player = 1 if current_player == 2 else 2
    
    if verbose:
        print("DRAW - board full")
    return 0, move_history


def analyze_game_history(history):
    """Analyze a game's move history for patterns."""
    p1_mistakes = [m for m in history if m['player'] == 1 and m['mistake']]
    p2_mistakes = [m for m in history if m['player'] == 2 and m['mistake']]
    
    return {
        'total_moves': len(history),
        'p1_mistakes': len(p1_mistakes),
        'p2_mistakes': len(p2_mistakes),
        'p1_mistake_details': [m['mistake'] for m in p1_mistakes],
        'p2_mistake_details': [m['mistake'] for m in p2_mistakes]
    }


def run_tournament(num_games=10):
    """Run multiple games and analyze results."""
    print("=" * 60)
    print("BOT VS BOT TOURNAMENT - GOMOKU HARD BOT ANALYSIS")
    print("=" * 60)
    
    bot1 = GomokuHardBot()  # Always plays as Player 1 (X)
    bot2 = GomokuHardBot()  # Always plays as Player 2 (O)
    
    results = {1: 0, 2: 0, 0: 0}  # Wins by player (0 = draw)
    all_mistakes = {1: [], 2: []}
    
    for game_num in range(num_games):
        print(f"\n--- Game {game_num + 1} ---")
        winner, history = run_game(bot1, bot2, verbose=True)
        results[winner] += 1
        
        analysis = analyze_game_history(history)
        all_mistakes[1].extend(analysis['p1_mistake_details'])
        all_mistakes[2].extend(analysis['p2_mistake_details'])
        
        print(f"Game {game_num + 1}: Winner = Player {winner if winner else 'DRAW'}")
        print(f"  P1 mistakes: {analysis['p1_mistakes']}, P2 mistakes: {analysis['p2_mistakes']}")
    
    print("\n" + "=" * 60)
    print("TOURNAMENT SUMMARY")
    print("=" * 60)
    print(f"Player 1 wins: {results[1]}")
    print(f"Player 2 wins: {results[2]}")
    print(f"Draws: {results[0]}")
    
    print(f"\nPlayer 1 total mistakes: {len(all_mistakes[1])}")
    for m in all_mistakes[1][:10]:  # Show first 10
        print(f"  - {m}")
    
    print(f"\nPlayer 2 total mistakes: {len(all_mistakes[2])}")
    for m in all_mistakes[2][:10]:
        print(f"  - {m}")
    
    return results, all_mistakes


if __name__ == "__main__":
    run_tournament(5)
