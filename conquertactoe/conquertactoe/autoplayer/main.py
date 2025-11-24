from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from bot_logic import HeuristicBot
from db import init_db, log_move
import uuid

app = FastAPI()
bot = HeuristicBot()

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

@app.get("/")
def read_root():
    return {"message": "Autoplayer Service is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/move")
def get_move(request: MoveRequest):
    try:
        move = bot.get_move(request.board, request.player_cones, request.bot_cones, request.difficulty)
        if not move:
            raise HTTPException(status_code=400, detail="No valid moves available")
        
        # Log to ClickHouse
        game_id = request.game_id or str(uuid.uuid4())
        try:
            log_move(game_id, request.board, request.player_cones, request.bot_cones, move, request.difficulty)
        except Exception as e:
            print(f"Failed to log move: {e}")

        return move
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
