# Bot Development Guide

This guide explains how to create and integrate new bots into the Conquer-Tac-Toe autoplayer system.

## Architecture Overview

The autoplayer service uses a modular architecture:
- **`core/`**: Contains the base interfaces and factory logic.
- **`bots/`**: Contains bot implementations organized by game variant.
- **`main.py`**: The FastAPI application that loads bots and handles requests.

## The `IBot` Interface

All bots must implement the `IBot` abstract base class defined in `core/bot_interface.py`.

```python
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class IBot(ABC):
    @abstractmethod
    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Calculate the next move based on the current game state.
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the display name of the bot"""
        pass
```

### Game State Structure

The `game_state` dictionary passed to `get_move` contains:

| Key | Type | Description |
|-----|------|-------------|
| `board` | `List[List[Optional[Dict]]]` | The game board. Cells are `None` or `{"player": int, "size": int}`. |
| `player_cones` | `List[int]` | Count of available cones for Player 1 (Human), indexed by size (0=small, 1=medium, 2=large). |
| `bot_cones` | `List[int]` | Count of available cones for Player 2 (Bot). |
| `difficulty` | `str` | "easy", "medium", or "hard". |
| `variant_id` | `int` | ID of the game variant (1=Classic, 2=Gomoku, 3+=Conquer). |
| `board_size` | `int` | Dimensions of the board (e.g., 3 or 15). |

### Return Value

Your bot should return a dictionary representing the move:

```python
{
    "row": int,       # 0-indexed row
    "col": int,       # 0-indexed column
    "cone_size": int  # 0 for Classic/Gomoku, 0-2 for Conquer variants
}
```

Return `None` if no valid move is found (though you should always try to return a valid move).

## Creating a New Bot

### 1. Create the Bot Class

Create a new file in `bots/<variant>/<your_bot_name>.py`.

```python
# bots/conquer/my_awesome_bot.py
import random
from typing import Dict, Any, Optional
from core.bot_interface import IBot

class AwesomeBot(IBot):
    @property
    def name(self) -> str:
        return "Awesome Bot v1"

    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        board = game_state["board"]
        # ... your logic here ...
        return {"row": 0, "col": 0, "cone_size": 0}
```

### 2. Register the Bot

Open `main.py` and register your new bot with the `BotFactory`.

```python
# main.py
from bots.conquer.my_awesome_bot import AwesomeBot

@app.on_event("startup")
def startup_event():
    # ... existing registrations ...
    
    # Register for a specific variant (e.g., Variant 4)
    BotFactory.register_bot(4, AwesomeBot())
```

## Best Practices

1.  **Statelessness**: Bots should be stateless. The `get_move` method receives everything it needs in `game_state`.
2.  **Error Handling**: If your logic fails, catch exceptions and try to return a fallback random move to keep the game going.
3.  **Performance**: The API expects a response quickly (typically < 1-2 seconds). Avoid extremely heavy computations.
4.  **Imports**: Always use **absolute imports** (e.g., `from core.bot_interface import IBot`), not relative imports.
