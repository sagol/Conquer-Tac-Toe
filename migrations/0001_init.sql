-- The D1 schema of plan 4.3, with sessions.created_at for the 90-day absolute cap (spec A-14). Migrations are
-- additive only (plan 4.5): once this file is applied anywhere remote it never changes. Times are Unix milliseconds.
CREATE TABLE users (
  id INTEGER PRIMARY KEY, google_sub TEXT UNIQUE, email TEXT, handle TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, created_at INTEGER NOT NULL, banned_until INTEGER, ban_reason TEXT,
  deleted_at INTEGER);
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE games (
  id TEXT PRIMARY KEY, variant TEXT NOT NULL, options TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('pvp','bot')), bot_level INTEGER, bot_rating REAL,
  p1 INTEGER REFERENCES users(id), p2 INTEGER REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('open','active','done','aborted','cancelled')),
  result TEXT CHECK (result IN ('p1','p2','draw')), reason TEXT,
  ended_by TEXT CHECK (ended_by IN ('p1','p2')), rated INTEGER NOT NULL DEFAULT 0,
  clock TEXT NOT NULL CHECK (clock IN ('live','relaxed')), season INTEGER,
  moves TEXT NOT NULL DEFAULT '', p1_delta REAL, p2_delta REAL,
  created_at INTEGER NOT NULL, ended_at INTEGER);
CREATE INDEX games_p1 ON games(p1, created_at DESC);
CREATE INDEX games_p2 ON games(p2, created_at DESC);
CREATE INDEX games_status ON games(status, variant);
CREATE TABLE game_ends (game_id TEXT PRIMARY KEY);
CREATE TABLE ratings (
  user_id INTEGER NOT NULL REFERENCES users(id), pool TEXT NOT NULL CHECK (pool IN ('pvp','bot')),
  season INTEGER NOT NULL, r REAL NOT NULL, rd REAL NOT NULL, vol REAL NOT NULL,
  seq INTEGER NOT NULL, last_at INTEGER NOT NULL,
  games INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, pool, season));
CREATE INDEX ratings_board ON ratings(pool, season, r DESC);
CREATE TABLE rating_log (
  user_id INTEGER NOT NULL REFERENCES users(id), pool TEXT NOT NULL CHECK (pool IN ('pvp','bot')),
  seq INTEGER NOT NULL, season INTEGER NOT NULL, game_id TEXT NOT NULL, r REAL NOT NULL, rd REAL NOT NULL,
  delta REAL NOT NULL, at INTEGER NOT NULL,
  PRIMARY KEY (user_id, pool, seq));
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, data TEXT NOT NULL, read_at INTEGER, created_at INTEGER NOT NULL);
CREATE INDEX notifications_user ON notifications(user_id, read_at, created_at DESC);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE audit_log (id INTEGER PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT, data TEXT, at INTEGER NOT NULL);
