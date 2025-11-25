-- Seed: Insert all 5 game variants
-- This populates the GameVariants table with the initial game types

-- Variant 1: Classic Tic-Tac-Toe
INSERT INTO GameVariants (variant_id, name, display_name, description, board_size, player1_cones, player2_cones, rules)
VALUES (
  1,
  'classic_tictactoe',
  'Classic Tic-Tac-Toe',
  'Traditional tic-tac-toe on a 3x3 board. Get 3 in a row to win! No cone sizes, just pure strategy.',
  3,
  '[1, 1, 1]',
  '[1, 1, 1]',
  '{
    "winConditions": ["three_in_row", "three_in_column", "three_in_diagonal"],
    "allowOverwrite": false,
    "requireLineLength": 3
  }'
)
ON CONFLICT (variant_id) DO NOTHING;

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
)
ON CONFLICT (variant_id) DO NOTHING;

-- Variant 3: Conquer-Tac-Toe (Classic) - CURRENT DEFAULT
INSERT INTO GameVariants (variant_id, name, display_name, description, board_size, player1_cones, player2_cones, rules)
VALUES (
  3,
  'conquer_classic',
  'Conquer Tac-Toe (Classic)',
  'Original Conquer Tic-Tac-Toe - use different sized cones strategically! Larger cones can replace smaller ones.',
  3,
  '[3, 3, 2]',
  '[3, 3, 2]',
  '{
    "winConditions": ["three_in_row", "three_in_column", "three_in_diagonal"],
    "allowOverwrite": true,
    "overwriteRules": "larger_cone_only",
    "requireLineLength": 3
  }'
)
ON CONFLICT (variant_id) DO NOTHING;

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
)
ON CONFLICT (variant_id) DO NOTHING;

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
)
ON CONFLICT (variant_id) DO NOTHING;

-- Reset the sequence to ensure future inserts use correct IDs
SELECT setval('gamevariants_variant_id_seq', (SELECT MAX(variant_id) FROM GameVariants));
