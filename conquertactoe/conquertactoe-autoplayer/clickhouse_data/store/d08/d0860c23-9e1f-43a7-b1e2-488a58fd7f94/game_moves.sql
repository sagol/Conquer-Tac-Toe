ATTACH TABLE _ UUID 'c32e87bb-bed1-4ced-9c5e-660b9003384f'
(
    `game_id` String,
    `timestamp` DateTime DEFAULT now(),
    `board_state` String,
    `player_cones` String,
    `bot_cones` String,
    `move_row` UInt8,
    `move_col` UInt8,
    `move_size` UInt8,
    `difficulty` String,
    `variant_id` UInt8 DEFAULT 3,
    `board_size` UInt8 DEFAULT 3
)
ENGINE = MergeTree
ORDER BY (game_id, timestamp)
SETTINGS index_granularity = 8192
