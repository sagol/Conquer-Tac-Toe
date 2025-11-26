from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from bot_logic import HeuristicBot, ClassicTicTacToeBot, GomokuBot
from db import init_db, log_move
import uuid

app = FastAPI()
conquer_bot = HeuristicBot()
classic_bot = ClassicTicTacToeBot()
gomoku_bot = GomokuBot()

@app.on_event("startup")
def startup_event():
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Failed to initialize ClickHouse: {e}")
        print("Continuing without database logging...")

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
    return {"message": "Autoplayer Service is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/move")
def get_move(request: MoveRequest):
    try:
        # Select bot based on variant
        # Variant 1: Classic Tic-Tac-Toe
        # Variant 2: Gomoku
        # Variants 3-5: Conquer variants
        
        print(f"[Autoplayer] Received move request for variant {request.variant_id}")
        print(f"[Autoplayer] Board size: {len(request.board)}x{len(request.board[0]) if request.board else 0}")
        print(f"[Autoplayer] Bot cones: {request.bot_cones}")
        
        move = None
        
        try:
            if request.variant_id == 1:
                # Classic Tic-Tac-Toe
                move = classic_bot.get_move(request.board, player=2)
            elif request.variant_id == 2:
                # Gomoku
                board_size = request.board_size or 15
                move = gomoku_bot.get_move(request.board, player=2, board_size=board_size)
            else:
                # Conquer-Tac-Toe variants (3, 4, 5)
                move = conquer_bot.get_move(request.board, request.player_cones, request.bot_cones, request.difficulty)
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

