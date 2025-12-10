-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS GameMoves;
DROP TABLE IF EXISTS Games;
DROP TABLE IF EXISTS Leaderboards;
DROP TABLE IF EXISTS GameRequests;
DROP TABLE IF EXISTS GameVariants;
DROP TABLE IF EXISTS Users;

-- Users Table
CREATE TABLE Users (
    user_id SERIAL PRIMARY KEY,
    oauth_id VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    profile_pic VARCHAR(255),
    total_games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    token VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user',
    login_count INTEGER DEFAULT 0,
    last_login_at TIMESTAMP,
    is_banned BOOLEAN DEFAULT false,
    ban_expires_at TIMESTAMP,
    ban_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GameVariants Table (NEW) - Stores all game type configurations
CREATE TABLE GameVariants (
    variant_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    board_size INTEGER NOT NULL DEFAULT 3,
    player1_cones JSONB NOT NULL DEFAULT '[3, 3, 2]',
    player2_cones JSONB NOT NULL DEFAULT '[3, 3, 2]',
    rules JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for GameVariants
CREATE INDEX idx_gamevariants_name ON GameVariants(name);
CREATE INDEX idx_gamevariants_active ON GameVariants(is_active);

-- Games Table
CREATE TABLE Games (
    game_id SERIAL PRIMARY KEY,
    player1_id INTEGER REFERENCES Users(user_id),
    player2_id INTEGER REFERENCES Users(user_id),
    winner_id INTEGER REFERENCES Users(user_id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GameMoves Table
CREATE TABLE GameMoves (
    move_id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES Games(game_id),
    player_id INTEGER REFERENCES Users(user_id),
    move_number INTEGER NOT NULL,
    cell_position INTEGER NOT NULL,
    cone_size VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboards Table
CREATE TABLE Leaderboards (
    leaderboard_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES Users(user_id),
    rank INTEGER NOT NULL,
    wins INTEGER NOT NULL,
    losses INTEGER NOT NULL,
    draws INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications Table
CREATE TABLE Notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES Users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for Notifications
CREATE INDEX idx_notifications_user ON Notifications(user_id);

-- GameRequests Table (UPDATED with variant_id)
CREATE TABLE GameRequests (
    id SERIAL PRIMARY KEY,
    creator_id INT NOT NULL,
    joiner_id INT,
    game_type VARCHAR(50),
    variant_id INTEGER REFERENCES GameVariants(variant_id) DEFAULT 3,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    board JSONB,
    active_player INTEGER,
    player1_cones JSONB,
    player2_cones JSONB,
    winner INTEGER,
    bot_difficulty VARCHAR(20) DEFAULT 'hard',
    last_move_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    move_timeout_seconds INTEGER DEFAULT 300
);

-- Create indexes for GameRequests
CREATE INDEX idx_gamerequests_variant ON GameRequests(variant_id);
CREATE INDEX idx_gamerequests_difficulty ON GameRequests(bot_difficulty);

-- ============================================
-- Application Configuration Table
-- ============================================
CREATE TABLE AppConfig (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for public config lookups
CREATE INDEX idx_appconfig_public ON AppConfig(is_public);

-- Seed initial configuration
INSERT INTO AppConfig (config_key, config_value, is_public, description)
VALUES 
    ('ENABLE_DEV_LOGIN', 'true', true, 'Show Dev Login option on login page for development'),
    
    -- Bot Difficulty Settings (per variant, default: hard)
    ('bot_difficulty_variant_1', 'hard', true, 'Default bot difficulty for Classic Tic-Tac-Toe (easy/medium/hard)'),
    ('bot_difficulty_variant_2', 'hard', true, 'Default bot difficulty for Gomoku (easy/medium/hard)'),
    ('bot_difficulty_variant_3', 'hard', true, 'Default bot difficulty for Conquer Classic (easy/medium/hard)'),
    ('bot_difficulty_variant_4', 'hard', true, 'Default bot difficulty for Conquer Same-Size (easy/medium/hard)'),
    ('bot_difficulty_variant_5', 'hard', true, 'Default bot difficulty for Conquer Custom (easy/medium/hard)'),
    
    -- Development & Debugging
    ('dev_logging', 'false', false, 'Enable detailed logging for development'),
    ('debug_mode', 'false', false, 'Enable debug mode for troubleshooting'),
    
    -- Site Operations
    ('maintenance_mode', 'false', true, 'Put site in maintenance mode (blocks normal access)'),
    ('new_registrations', 'true', true, 'Allow new user registrations'),
    ('game_creation', 'true', true, 'Allow users to create new games'),
    
    -- Gameplay Settings
    ('max_active_games_per_user', '10', true, 'Maximum number of active games per user'),
    
    -- Performance & Security
    ('rate_limit_per_min', '60', false, 'Rate limit for API requests per minute'),
    ('session_timeout_minutes', '60', false, 'Session timeout duration in minutes');

-- ============================================
-- SEED DATA: Game Variants
-- ============================================

-- Variant 1: Classic Tic-Tac-Toe
INSERT INTO GameVariants (variant_id, name, display_name, description, board_size, player1_cones, player2_cones, rules)
VALUES (
    1,
    'classic_tictactoe',
    'Classic Tic-Tac-Toe',
    'Traditional tic-tac-toe on a 3x3 board. Get 3 in a row to win! No cone sizes, just pure strategy.',
    3,
    '[999]',
    '[999]',
    '{
        "winConditions": ["three_in_row", "three_in_column", "three_in_diagonal"],
        "allowOverwrite": false,
        "requireLineLength": 3
    }'
);

-- Variant 2: 5-in-Line (Gomoku)
INSERT INTO GameVariants (variant_id, name, display_name, description, board_size, player1_cones, player2_cones, rules)
VALUES (
    2,
    'five_in_line',
    '5-in-Line (Gomoku)',
    'Get 5 in a row on a larger board. Strategic and challenging! Choose your board size from 10x10 to 19x19.',
    15,
    '[999]',
    '[999]',
    '{
        "winConditions": ["five_in_row", "five_in_column", "five_in_diagonal"],
        "allowOverwrite": false,
        "requireLineLength": 5,
        "boardSizeOptions": [10, 13, 15, 19]
    }'
);

-- Variant 3: Conquer-Tac-Toe (Classic) - DEFAULT
INSERT INTO GameVariants (variant_id, name, display_name, description, board_size, player1_cones, player2_cones, rules)
VALUES (
    3,
    'conquer_classic',
    'Conquer Tac-Toe (Classic)',
    'Original Conquer Tic-Tac-Toe - use different sized cones strategically! Larger cones can replace smaller ones.',
    3,
    '[3, 3, 3]',
    '[3, 3, 3]',
    '{
        "winConditions": ["three_in_row", "three_in_column", "three_in_diagonal"],
        "allowOverwrite": true,
        "overwriteRules": "larger_cone_only",
        "requireLineLength": 3
    }'
);

-- Variant 4: Conquer-Tac-Toe (Same-Size Replace)
INSERT INTO GameVariants (variant_id, name, display_name, description, board_size, player1_cones, player2_cones, rules)
VALUES (
    4,
    'conquer_same_size',
    'Conquer Tac-Toe (Same-Size)',
    'Enhanced rules! Replace cones with the same size OR larger. More tactical options for advanced players.',
    3,
    '[3, 3, 2]',
    '[3, 3, 2]',
    '{
        "winConditions": ["three_in_row", "three_in_column", "three_in_diagonal"],
        "allowOverwrite": true,
        "overwriteRules": "larger_or_same_size",
        "requireLineLength": 3
    }'
);

-- Variant 5: Conquer-Tac-Toe (Custom Cones)
INSERT INTO GameVariants (variant_id, name, display_name, description, board_size, player1_cones, player2_cones, rules)
VALUES (
    5,
    'conquer_custom',
    'Conquer Tac-Toe (Custom)',
    'Create your own strategy! Choose how many small, medium, and large cones you want. Maximum 5 of each size.',
    3,
    '[3, 3, 2]',
    '[3, 3, 2]',
    '{
        "winConditions": ["three_in_row", "three_in_column", "three_in_diagonal"],
        "allowOverwrite": true,
        "overwriteRules": "larger_cone_only",
        "requireLineLength": 3,
        "allowCustomCones": true,
        "coneOptions": {
            "small": [0, 1, 2, 3, 4, 5],
            "medium": [0, 1, 2, 3, 4, 5],
            "large": [0, 1, 2, 3, 4, 5]
        }
    }'
);

-- Reset sequence to ensure future manual inserts work correctly
SELECT setval('gamevariants_variant_id_seq', (SELECT MAX(variant_id) FROM GameVariants));