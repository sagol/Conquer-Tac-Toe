from typing import Dict, Optional
from .bot_interface import IBot

class BotFactory:
    """
    Factory class to manage and retrieve bot instances.
    Supports registering bots for specific game variants and difficulty levels.
    """

    # Nested dict structure: {variant_id: {difficulty: bot_instance}}
    _bots: Dict[int, Dict[str, IBot]] = {}

    @classmethod
    def register_bot(cls, variant_id: int, difficulty: str, bot: IBot):
        """
        Register a bot instance for a specific game variant and difficulty.

        :param variant_id: The ID of the game variant (e.g., 1 for Classic, 2 for Gomoku)
        :param difficulty: The difficulty level ('easy', 'medium', 'hard')
        :param bot: An instance of a class implementing IBot
        """
        if variant_id not in cls._bots:
            cls._bots[variant_id] = {}

        cls._bots[variant_id][difficulty.lower()] = bot
        print(f"[BotFactory] Registered bot '{bot.name}' for variant {variant_id}, difficulty '{difficulty}'")

    @classmethod
    def get_bot(cls, variant_id: int, difficulty: str = 'easy') -> Optional[IBot]:
        """
        Retrieve the bot registered for a specific variant and difficulty.
        Falls back to 'easy' if requested difficulty is not found.

        :param variant_id: The game variant ID
        :param difficulty: The difficulty level (default: 'easy')
        :return: The bot instance or None if not found
        """
        difficulty = difficulty.lower()

        if variant_id not in cls._bots:
            print(f"[BotFactory] No bots registered for variant {variant_id}")
            return None

        variant_bots = cls._bots[variant_id]

        # Try requested difficulty
        if difficulty in variant_bots:
            return variant_bots[difficulty]

        # Fallback to easy
        if 'easy' in variant_bots:
            print(f"[BotFactory] Difficulty '{difficulty}' not found for variant {variant_id}, falling back to 'easy'")
            return variant_bots['easy']

        print(f"[BotFactory] No bot found for variant {variant_id}, difficulty '{difficulty}'")
        return None

    @classmethod
    def list_bots(cls) -> Dict[int, Dict[str, str]]:
        """Return a nested dictionary of registered bots {variant_id: {difficulty: bot_name}}"""
        return {
            vid: {diff: bot.name for diff, bot in bots.items()}
            for vid, bots in cls._bots.items()
        }

