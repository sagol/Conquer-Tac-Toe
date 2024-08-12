-- Drop existing tables
DROP TABLE IF EXISTS GameMoves;
DROP TABLE IF EXISTS Games;
DROP TABLE IF EXISTS Leaderboards;
DROP TABLE IF EXISTS Users;

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    user_id SERIAL PRIMARY KEY,
    oauth_id VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    profile_pic VARCHAR(255),
    total_games INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    token VARCHAR(255), -- Add this line
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- GameRequests Table
CREATE TABLE GameRequests (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL,
  joiner_id INT,
  game_type VARCHAR(50),
  status VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  board JSONB,
  active_player INTEGER,
  player1_cones JSONB,
  player2_cones JSONB,
  winner INTEGER
);