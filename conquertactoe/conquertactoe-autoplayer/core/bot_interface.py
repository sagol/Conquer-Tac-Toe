from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class IBot(ABC):
    """
    Abstract Base Class for all bots.
    Defines the standard interface that all game bots must implement.
    """
    
    @abstractmethod
    def get_move(self, game_state: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Calculate the next move based on the current game state.
        
        :param game_state: Dictionary containing:
            - board: List[List[Optional[Dict]]] - The game board
            - player_cones: List[int] - Available cones for player (if applicable)
            - bot_cones: List[int] - Available cones for bot (if applicable)
            - difficulty: str - Difficulty level (easy, medium, hard)
            - variant_id: int - Game variant ID
            - board_size: int - Size of the board (e.g., 3, 15)
            
        :return: Dictionary representing the move:
            - row: int
            - col: int
            - cone_size: int (0 for simple markers)
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the display name of the bot"""
        pass
