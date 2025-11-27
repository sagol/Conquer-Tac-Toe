from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from db import init_db, log_move
import uuid

# Import new architecture components
from core.bot_factory import BotFactory
from bots.classic.minimax_bot import ClassicTicTacToeBot
from bots.gomoku.advanced_bot import GomokuBot
from bots.conquer.heuristic_bot import HeuristicBot

app = FastAPI()

@app.on_event("startup")
def startup_event():
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Failed to initialize ClickHouse: {e}")
        print("Continuing without database logging...")
    
    # Register bots
    # Variant 1: Classic Tic-Tac-Toe
    BotFactory.register_bot(1, ClassicTicTacToeBot())
    
    # Variant 2: Gomoku
    BotFactory.register_bot(2, GomokuBot())
    
    # Variants 3-5: Conquer variants (using same heuristic bot for now)
    conquer_bot = HeuristicBot()
    BotFactory.register_bot(3, conquer_bot)
    BotFactory.register_bot(4, conquer_bot)
    BotFactory.register_bot(5, conquer_bot)

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
        
        # Get appropriate bot from factory
        bot = BotFactory.get_bot(request.variant_id)
        
        if not bot:
            print(f"[Autoplayer] No bot registered for variant {request.variant_id}")
            raise HTTPException(status_code=400, detail=f"No bot available for variant {request.variant_id}")
            
        print(f"[Autoplayer] Using bot: {bot.name}")
        
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

