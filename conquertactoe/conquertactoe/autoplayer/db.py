from clickhouse_driver import Client
import os
import time

CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "clickhouse")

def get_client():
    return Client(host=CLICKHOUSE_HOST)

def init_db():
    client = get_client()
    # Retry logic for DB connection
    for i in range(5):
        try:
            client.execute("SELECT 1")
            print("Connected to ClickHouse")
            break
        except Exception as e:
            print(f"Waiting for ClickHouse... ({e})")
            time.sleep(2)
    
    # Create table if not exists
    client.execute("""
        CREATE TABLE IF NOT EXISTS game_moves (
            game_id String,
            timestamp DateTime DEFAULT now(),
            board_state String,
            player_cones String,
            bot_cones String,
            move_row UInt8,
            move_col UInt8,
            move_size UInt8,
            difficulty String,
            variant_id UInt8 DEFAULT 3,
            board_size UInt8 DEFAULT 3
        ) ENGINE = MergeTree()
        ORDER BY (game_id, timestamp)
    """)
    
    # Alter table to add columns if they don't exist (for existing deployments)
    try:
        client.execute("ALTER TABLE game_moves ADD COLUMN IF NOT EXISTS variant_id UInt8 DEFAULT 3")
        client.execute("ALTER TABLE game_moves ADD COLUMN IF NOT EXISTS board_size UInt8 DEFAULT 3")
    except Exception as e:
        print(f"Schema update warning: {e}")

    print("Database initialized")

def log_move(game_id, board, player_cones, bot_cones, move, difficulty, variant_id=3, board_size=3):
    client = get_client()
    client.execute(
        "INSERT INTO game_moves (game_id, board_state, player_cones, bot_cones, move_row, move_col, move_size, difficulty, variant_id, board_size) VALUES",
        [(
            game_id,
            str(board),
            str(player_cones),
            str(bot_cones),
            move['row'],
            move['col'],
            move['cone_size'],
            difficulty,
            variant_id,
            board_size
        )]
    )
    print(f"Logged move for game {game_id}")
