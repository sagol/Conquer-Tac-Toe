-- Migration: Add variant_id to GameRequests table
-- This links each game to a specific game variant

ALTER TABLE GameRequests 
ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES GameVariants(variant_id) DEFAULT 1;

-- Create index for filtering by variant
CREATE INDEX IF NOT EXISTS idx_gamerequests_variant ON GameRequests(variant_id);

-- For existing games, set to Classic Conquer-Tac-Toe (variant_id = 3)
-- This ensures backward compatibility
UPDATE GameRequests 
SET variant_id = 3 
WHERE variant_id IS NULL;

COMMENT ON COLUMN GameRequests.variant_id IS 'References the game variant for this game (e.g., Classic, Gomoku, Conquer)';
