from typing import Dict, Optional
from .bot_interface import IBot

class BotFactory:
    """
    Factory class to manage and retrieve bot instances.
    Supports registering bots for specific game variants.
    """
    
    _bots: Dict[int, IBot] = {}

    @classmethod
    def register_bot(cls, variant_id: int, bot: IBot):
        """
        Register a bot instance for a specific game variant.
        
        :param variant_id: The ID of the game variant (e.g., 1 for Classic, 2 for Gomoku)
        :param bot: An instance of a class implementing IBot
        """
        cls._bots[variant_id] = bot
        print(f"[BotFactory] Registered bot '{bot.name}' for variant {variant_id}")

    @classmethod
    def get_bot(cls, variant_id: int) -> Optional[IBot]:
        """
        Retrieve the bot registered for a specific variant.
        
        :param variant_id: The game variant ID
        :return: The bot instance or None if not found
        """
        return cls._bots.get(variant_id)

    @classmethod
    def list_bots(cls) -> Dict[int, str]:
        """Return a dictionary of registered bots {variant_id: bot_name}"""
        return {vid: bot.name for vid, bot in cls._bots.items()}
