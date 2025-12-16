from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from db import init_db, log_move
import uuid

# Import all bot implementations
from core.bot_factory import BotFactory

# Classic Tic-Tac-Toe bots
from bots.classic.easy_bot import ClassicEasyBot
from bots.classic.medium_bot import ClassicMediumBot
from bots.classic.hard_bot import ClassicHardBot

# Gomoku bots
from bots.gomoku.easy_bot import GomokuEasyBot
from bots.gomoku.medium_bot import GomokuMediumBot
from bots.gomoku.hard_bot import GomokuHardBot

# Conquer bots
from bots.conquer.easy_bot import ConquerEasyBot
from bots.conquer.medium_bot import ConquerMediumBot
from bots.conquer.hard_bot import ConquerHardBot

app = FastAPI()

@app.on_event("startup")
def startup_event():
    try:
        init_db()
        print("[Database] ClickHouse initialized successfully")
    except Exception as e:
        print(f"Warning: Failed to initialize ClickHouse: {e}")
        print("Continuing without database logging...")

    print("[BotFactory] Registering all bots (5 variants × 4 difficulties)")

    # Variant 1: Classic Tic-Tac-Toe
    BotFactory.register_bot(1, 'easy', ClassicEasyBot())
    BotFactory.register_bot(1, 'medium', ClassicMediumBot())
    BotFactory.register_bot(1, 'hard', ClassicHardBot())

    # Variant 2: Gomoku (5-in-Line)
    BotFactory.register_bot(2, 'easy', GomokuEasyBot())
    BotFactory.register_bot(2, 'medium', GomokuMediumBot())
    BotFactory.register_bot(2, 'hard', GomokuHardBot())

    # Variants 3-5: Conquer variants (all use same bots)
    conquer_easy = ConquerEasyBot()
    conquer_medium = ConquerMediumBot()
    conquer_hard = ConquerHardBot()

    for variant_id in [3, 4, 5]:
        BotFactory.register_bot(variant_id, 'easy', conquer_easy)
        BotFactory.register_bot(variant_id, 'medium', conquer_medium)
        BotFactory.register_bot(variant_id, 'hard', conquer_hard)

    print("[BotFactory] ✓ All 15 bots registered successfully")
    print("[BotFactory] Registered bots:", BotFactory.list_bots())

class MoveRequest(BaseModel):
    game_id: Optional[str] = None
    board: List[List[Optional[Dict[str, Any]]]]
    player_cones: List[int]
    bot_cones: List[int]
    difficulty: str = "medium"
    variant_id: Optional[int] = 3  # Default to Conquer Classic
    board_size: Optional[int] = 3

@app.get("/")
def read_root():
    return {"message": "Autoplayer Service is running", "bots": BotFactory.list_bots()}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/move")
def get_move(request: MoveRequest):
    try:
        print(f"[Autoplayer] Received move request for variant {request.variant_id}")
        print(f"[Autoplayer] Board size: {len(request.board)}x{len(request.board[0]) if request.board else 0}")

        # Get appropriate bot from factory (with difficulty)
        bot = BotFactory.get_bot(request.variant_id, request.difficulty)

        if not bot:
            print(f"[Autoplayer] No bot registered for variant {request.variant_id}, difficulty '{request.difficulty}'")
            raise HTTPException(status_code=400, detail=f"No bot available for variant {request.variant_id} with difficulty '{request.difficulty}'")

        print(f"[Autoplayer] Using bot: {bot.name}")

        # Debug: Count pieces on board and log positions
        player1_count = 0
        player2_count = 0
        player1_positions = []
        player2_positions = []
        for r_idx, row in enumerate(request.board):
            for c_idx, cell in enumerate(row):
                if cell and isinstance(cell, dict):
                    if cell.get('player') == 1:
                        player1_count += 1
                        player1_positions.append((r_idx, c_idx))
                    elif cell.get('player') == 2:
                        player2_count += 1
                        player2_positions.append((r_idx, c_idx))
        print(f"[Autoplayer] Board pieces - Player(orange): {player1_count}, Bot(green): {player2_count}")
        print(f"[Autoplayer] Player positions: {player1_positions}")
        print(f"[Autoplayer] Bot positions: {player2_positions}")

        # Prepare game state dictionary
        game_state = {
            "board": request.board,
            "player_cones": request.player_cones,
            "bot_cones": request.bot_cones,
            "difficulty": request.difficulty,
            "variant_id": request.variant_id,
            "board_size": request.board_size
        }

        try:
            move = bot.get_move(game_state)
        except Exception as bot_error:
            print(f"[Autoplayer] Bot logic error: {type(bot_error).__name__}: {bot_error}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Bot logic failed: {str(bot_error)}")

        if not move:
            print("[Autoplayer] No valid move found")
            raise HTTPException(status_code=400, detail="No valid moves available")

        print(f"[Autoplayer] Bot selected move: {move}")

        # Log to ClickHouse
        game_id = request.game_id or str(uuid.uuid4())
        try:
            log_move(
                game_id,
                request.board,
                request.player_cones,
                request.bot_cones,
                move,
                request.difficulty,
                request.variant_id,
                request.board_size
            )
        except Exception as log_error:
            print(f"[Autoplayer] Failed to log move: {log_error}")
            # Continue anyway - logging failure shouldn't stop the game

        return move
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        print(f"[Autoplayer] Unexpected error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

