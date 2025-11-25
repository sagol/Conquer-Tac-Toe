-- Migration: Create GameVariants table
-- This table stores configuration for all game variants

CREATE TABLE IF NOT EXISTS GameVariants (
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_gamevariants_name ON GameVariants(name);
CREATE INDEX IF NOT EXISTS idx_gamevariants_active ON GameVariants(is_active);

-- Add comment for documentation
COMMENT ON TABLE GameVariants IS 'Stores configuration for different game variants (Classic, Gomoku, Conquer variants)';
COMMENT ON COLUMN GameVariants.rules IS 'JSONB containing variant-specific rules like win conditions, overwrite rules, etc.';
