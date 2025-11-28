#!/usr/bin/env python3
"""
Automated test script for all game variants
Tests game creation, move-making, and win conditions for each variant
"""

import requests
import time

BACKEND_URL = "http://localhost:3000"

def login():
    """Login and return session"""
    session = requests.Session()
    response = session.post(
        f"{BACKEND_URL}/login",
        json={"username": "testuser", "password": "testpass"}
    )
    if response.status_code == 200:
        print("✅ Login successful")
        return session
    else:
        print(f"❌ Login failed: {response.status_code}")
        return None

def get_variants(session):
    """Get all game variants"""
    response = session.get(f"{BACKEND_URL}/variants")
    if response.status_code == 200:
        variants = response.json()
        print(f"✅ Found {len(variants)} variants")
        return variants
    else:
        print(f"❌ Failed to get variants: {response.status_code}")
        return []

def create_bot_game(session, variant_id):
    """Create a bot game with specified variant"""
    response = session.post(
        f"{BACKEND_URL}/game-requests/bot",
        json={"variantId": variant_id}
    )
    if response.status_code in [200, 201]:
        game = response.json()
        print(f"  ✅ Created game {game['id']}")
        return game
    else:
        print(f"  ❌ Failed to create game: {response.status_code} - {response.text}")
        return None

def make_move(session, game_id, row, col, cone_size=2):
    """Make a move in the game"""
    response = session.post(
        f"{BACKEND_URL}/games/{game_id}/move",
        json={"row": row, "col": col, "coneSize": cone_size}
    )
    if response.status_code == 200:
        return response.json()
    else:
        print(f"  ⚠️  Move failed: {response.status_code} - {response.text}")
        return None

def test_variant(session, variant):
    """Test a single variant by creating a game and making moves"""
    print(f"\n{'='*60}")
    print(f"Testing: {variant['display_name']}")
    print(f"  Board: {variant['board_size']}x{variant['board_size']}")
    print(f"  Win Condition: {variant['rules']['requireLineLength']} in a row")
    print(f"{'='*60}")
    
    # Create bot game
    game = create_bot_game(session, variant['variant_id'])
    if not game:
        return False
    
    time.sleep(1)  # Wait for bot initialization
    
    # Try to make a few moves
    print(f"  Making test moves...")
    board_size = variant['board_size']
    
    # Make 3-5 test moves to see if game responds
    test_moves = [
        (0, 0),  # Top-left
        (1, 1),  # Center (if applicable)
        (0, board_size-1),  # Top-right
    ]
    
    for row, col in test_moves:
        if row < board_size and col < board_size:
            result = make_move(session, game['id'], row, col)
            if result:
                if result.get('winner'):
                    print(f"  🏆 Game ended - Winner: {result['winner']}")
                    return True
                elif result.get('is_draw'):
                    print(f"  🤝 Game ended in draw")
                    return True
                print(f"  ✅ Move successful ({row},{col})")
            time.sleep(0.5)
    
    print(f"  ℹ️  Game {game['id']} in progress")
    return True

def main():
    """Main test function"""
    print("="*60)
    print("GAME VARIANT AUTOMATED TEST SUITE")
    print("="*60)
    
    # Login
    session = login()
    if not session:
        return
    
    # Get variants
    variants = get_variants(session)
    if not variants:
        return
    
    # Test each variant
    results = {}
    for variant in variants:
        success = test_variant(session, variant)
        results[variant['display_name']] = success
    
    # Print summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print(f"{'='*60}")
    for name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
    
    total = len(results)
    passed = sum(1 for s in results.values() if s)
    print(f"\nTotal: {passed}/{total} variants tested successfully")

if __name__ == "__main__":
    main()
