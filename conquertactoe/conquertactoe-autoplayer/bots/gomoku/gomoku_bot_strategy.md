# COMPREHENSIVE GOMOKU BOT STRATEGY GUIDE
## Based on Analysis of Academic Research & AI Player Architectures

---

## TABLE OF CONTENTS
1. [Strategic Foundation](#strategic-foundation)
2. [Pattern Recognition & Threat Detection](#pattern-recognition--threat-detection)
3. [Opening Strategy](#opening-strategy)
4. [Midgame Strategy](#midgame-strategy)
5. [Endgame Strategy](#endgame-strategy)
6. [Algorithm Implementation](#algorithm-implementation)
7. [Move Selection Algorithm](#move-selection-algorithm)
8. [Evaluation Functions](#evaluation-functions)

---

## STRATEGIC FOUNDATION

### Core Principles

#### 1. Threat-Based Strategy
Gomoku strategy revolves around **creating and responding to threats**:
- **Victory (V)**: A winning pattern - 5 in a row
- **Attack (A)**: Can become victory in n moves
- **Threat (T)**: Can become attack in n moves

#### 2. Pattern Classification by Strength
1. **Simple Five (S5)** - Five in a row → V0 (Immediate win)
2. **Double Four (D4)** - Two S4 with disjoint defenses → V1 (1 move to win)
3. **Simple Four (S4)** - Four stones + one empty → A1 (Forced response needed)
4. **Weak Three (W3)** - Two S3 intersecting → A2 (2 moves to win threat)
5. **Double Three (D3)** - Two W3 intersecting → A2 (2 trigger points)
6. **Simple Three (S3)** - Three stones + two empty → T2 (Requires follow-up)
7. **Broken Three** - Three non-consecutive stones → T3 (More complex threat)

#### 3. Rational Player Model
Both players:
- Win as quickly as possible (fewest moves)
- Lose as slowly as possible (most moves)
- Respond immediately to imminent threats

---

## PATTERN RECOGNITION & THREAT DETECTION

### Essential Patterns for Bot

#### 1. Line Analysis (One-Dimensional)
For each position on board, analyze 4 directions:
- Horizontal
- Vertical
- Diagonal (↗)
- Diagonal (↖)

For each direction, track:
```
Line Structure: [Blocks of 1-5 consecutive stones]
State: (empty, black, white)
Density: Count of stones in 9-point window around position
Free Space: Empty squares available to extend threat
```

#### 2. Threat Scoring System
Each line/pattern receives score based on:
```
Score(pattern) = ∑ [player_stones × weight_factor]

Weight factors:
- 5 consecutive same color: ∞ (Instant win/loss)
- 4 consecutive + 1 empty (open): 100 (Critical threat)
- 4 consecutive + 1 blocked: 50 (Blocked threat)
- 3 consecutive + 2 empty (open three): 25
- 3 consecutive + 1 empty + 1 block: 15
- 2 consecutive + 3 empty: 5
```

#### 3. Combo Detection (Highest Priority)
**Combo**: Two threats on different orientations that share a blocking point
- When placed, creates two simultaneous winning threats
- Opponent cannot block both

```
Detection algorithm:
For each empty position p:
  For each orientation pair (horizontal, vertical/diagonal):
    If both contain high-value patterns intersecting at p:
      If blocking patterns with independent defense:
        COMBO FOUND → Priority move
```

#### 4. Threat Trees (VCF - Victory by Continuous Forcing)
```
Sequence of moves where each black move creates a threat
and white is forced to respond:

Example (S3-based):
1. Black plays threat → creates S3
2. White must defend → blocks one end
3. Black plays → creates S4
4. White must defend → blocks the four
5. Black plays → creates D4 or second S4
6. White cannot defend both → Black wins
```

---

## OPENING STRATEGY

### Optimal Opening Moves (First 4 Moves)

#### Move 1 (Black - First Player Advantage)
```
Placement: Center of board or slightly off-center
Reasoning:
- Maximizes board control
- Creates most potential threat patterns
- First-player advantage is ~60% win rate
```

#### Move 2-4 (Development Phase)
```
Objectives:
1. Avoid playing adjacent immediately (allows opponent counter-threats)
2. Create flexibility - avoid committed patterns
3. Build redundant threats
4. Maintain distance to allow diagonal/forward expansion

Key Principle: Position stones so they can be part of MULTIPLE potential threats
```

#### Opening Patterns to Avoid
```
❌ Irrational patterns:
   - Two separate simple fours (opponent can block both)
   - All stones in straight line (reduces flexibility)
   - Playing too close (creates vulnerable clusters)

✓ Smart opening:
   - Stones separated 2-4 squares
   - Arranged to form multiple threat patterns
   - Positioned for future threat trees
```

---

## MIDGAME STRATEGY

### Decision-Making Hierarchy

#### Priority 1: Immediate Wins (Execute)
```
IF player has S5:
  Play immediately → WIN

IF player has unblockable threat (D4):
  Play immediately → WIN next turn
```

#### Priority 2: Defense Against Opponent
```
IF opponent has S4 (unblockable four):
  MUST BLOCK immediately
  (Otherwise opponent wins next turn)

IF opponent has D4:
  CANNOT WIN - opponent has two threats
  Look for own forcing threats to counter-attack

IF opponent has active S3 → W3:
  Defend one end → prevents conversion to S4
```

#### Priority 3: Create Forcing Threats
```
Objective: Sequence of moves that force opponent responses
Strategy:
  1. Play move that creates S3 or higher
  2. Opponent is forced to defend
  3. Player creates new threat elsewhere
  4. Eventually opponent cannot defend all threats

Implementation:
  For each empty position p:
    Calculate if move creates forcing sequence
    Score = depth_of_sequence + number_of_opponent_responses
```

#### Priority 4: Offensive Expansion
```
Build toward victory by:
- Adding stones to weak threats (T3 → T2 → A2 → A1)
- Creating multiple weak patterns
- Maintaining flexibility to pivot
- Preventing opponent from doing same
```

#### Priority 5: General Position Building
```
IF no immediate threats:
  Play on high-value positions:
  - Positions covered by multiple monomials
  - Positions that strengthen existing patterns
  - Positions near own stones
```

### Mid-Game Threat Construction

#### Building a Threat Tree
```
Phase 1 - Create Base Threat:
  Single S3 or W3 on board
  
Phase 2 - Prepare Second Threat:
  Position for second threat on different line
  
Phase 3 - Converge:
  Create forcing sequence where both become threats
  
Phase 4 - Victory:
  Opponent cannot defend both simultaneously
```

---

## ENDGAME STRATEGY

### Detection of Winning/Losing Positions

#### Guaranteed Win Detection
```
Position is winning if:
1. Player has V0 or V1 unblockable victory
2. Player has forcing sequence of depth d
   AND opponent cannot counter-force before then
3. Player has two independent D3/W3 with disjoint defenses
```

#### Guaranteed Loss Detection
```
Position is losing if:
1. Opponent has unblockable victory
2. Opponent has forcing sequence player cannot stop
3. Player's all remaining threats are blockable
```

### Endgame Search Depth
```
Recommended depth based on move count:
- Moves 1-15: Depth 4-5 plies (full patterns)
- Moves 15-25: Depth 6-8 plies (threat sequences)
- Moves 25+: Depth 10+ plies (forced sequences)
- Final moves: Full game tree search if feasible
```

---

## ALGORITHM IMPLEMENTATION

### Architecture Overview

```
┌─────────────────────────────────────────┐
│   GOMOKU BOT - UNIFIED ARCHITECTURE     │
├─────────────────────────────────────────┤
│                                         │
│  1. BOARD STATE REPRESENTATION          │
│     - Monomial-based or Line-based      │
│                                         │
│  2. PATTERN DETECTION ENGINE            │
│     - Real-time threat scanning         │
│     - Combo detection                   │
│                                         │
│  3. MOVE EVALUATION SYSTEM              │
│     - Score each legal move             │
│     - Rank by strategic value           │
│                                         │
│  4. SEARCH ALGORITHM                    │
│     - Minimax with Alpha-Beta           │
│     - Monte Carlo Tree Search (MCTS)    │
│     - Threat Space Search               │
│                                         │
│  5. DECISION MAKING                     │
│     - Select best move from rankings    │
│                                         │
└─────────────────────────────────────────┘
```

### Board State Representation

#### Option A: Monomial-Based (Recommended for Speed)
```
For each of 1020 possible 5-in-a-row lines:
  - Store current state (active/dead/won)
  - Store score (0 = dead, 1-31 = active, 32 = won)
  - Track which variables (stones) contribute

Advantages:
  - O(1) updates per move (only 20 monomials affected)
  - Easy threat identification via scores
  - Efficient locality analysis

Formula for # of monomials:
  2(n(n - 5 + 1) + (n - 5 + 1)²) = 1020 for 15×15 board
  (horizontal + vertical lines, both directions of diagonals)
```

#### Option B: Line-Based (Alternative)
```
For each row, column, diagonal:
  - Store continuous segments of same color
  - Track gaps and freedoms

Advantages:
  - Easier visualization
  - More intuitive pattern matching
```

### Incremental Score Updating

```
When stone placed at position p by player X:

1. Find all monomials containing p
   (Max 20 for center, fewer for edges)
   
2. For each monomial m:
   IF X is black:
     score(m) *= 2  (black's contribution increases)
   ELSE:
     score(m) = 0   (white kills the threat)
     
3. For opponent's monomials covering p:
   Same logic reversed
   
Complexity: O(20) per move = O(1)
vs. O(n²) for full board rescanning
```

---

## MOVE SELECTION ALGORITHM

### Complete Move Selection Framework

```
FUNCTION SelectMove(board_state, my_color, opponent_color, time_limit):

  // STEP 1: Pattern Detection & Threat Identification
  my_threats = ScanForThreats(board_state, my_color)
  opp_threats = ScanForThreats(board_state, opponent_color)
  
  immediate_wins = FilterByType(my_threats, ['S5', 'D4'])
  immediate_losses = FilterByType(opp_threats, ['S5', 'D4'])
  
  // STEP 2: Priority-Based Decision Making
  
  if immediate_wins is not empty:
    RETURN MoveToExecuteThreat(immediate_wins[0])
  
  if immediate_losses is not empty:
    RETURN MoveToBlockThreat(immediate_losses[0])
  
  // STEP 3: Combo & Forcing Sequence Search
  combos = DetectCombos(board_state, my_color)
  if combos is not empty:
    best_combo = SelectBestCombo(combos)
    RETURN best_combo.trigger_move
  
  forcing_sequences = FindForcingSequences(board_state, my_color, depth=6)
  if forcing_sequences is not empty:
    best_sequence = SelectByForcingDepth(forcing_sequences)
    RETURN best_sequence.first_move
  
  // STEP 4: General Evaluation
  candidate_moves = GenerateMoveList(board_state)
  
  FOR each move in candidate_moves:
    score = 0
    
    // Offensive value
    threat_value = EvaluateNewThreats(board_state, move, my_color)
    score += threat_value * 10
    
    // Defensive value
    opponent_block_value = CalculateBlockValue(board_state, move, opponent_color)
    score += opponent_block_value * 8
    
    // Positional value
    pos_value = EvaluatePosition(board_state, move)
    score += pos_value * 2
    
    candidate_moves[move].score = score
  
  // STEP 5: Search & Verification
  best_candidate = SelectTopKMoves(candidate_moves, k=5)
  
  if time_available >= min_search_time:
    verified_best = VerifyWithMinimax(best_candidate, depth=4-8)
    RETURN verified_best
  else:
    RETURN best_candidate[0]
```

### Move Generation Strategies

#### Naive Strategy (Inefficient)
```
Generate ALL 225 legal moves
Evaluate each one
Time complexity: O(225 × evaluation_cost)
```

#### Smart Strategy (Recommended)
```
Generate moves only in "region of interest":
1. All positions adjacent to existing stones (distance ≤ 2)
2. All positions that block opponent threats
3. All positions that extend own threats

Region size: ~30-50 moves vs. 225
Time complexity: O(50 × evaluation_cost)
```

#### Best Strategy (MCTS-Based)
```
Start with initial set of ~30 candidate moves
Simulate future game states from each
Expand promising branches
Prune unpromising ones
Time complexity: Depends on simulation budget
```

---

## EVALUATION FUNCTIONS

### Pattern-Based Evaluation

```
EvaluatePosition(position, my_color):
  
  score = 0
  
  for each monomial m covering position:
    if m is alive (not blocked by opponent):
      
      # Count my stones in this line
      my_count = CountStones(m, my_color)
      
      # How many free squares remain
      free_spaces = 5 - my_count - opponent_count
      
      # Calculate threat level
      if my_count == 4 and free_spaces == 1:
        threat = 1000  # S4 - immediate threat
      elif my_count == 3 and free_spaces == 2:
        threat = 100   # S3 - creates option
      elif my_count == 2 and free_spaces == 3:
        threat = 10    # Foundation
      elif my_count == 1 and free_spaces == 4:
        threat = 1     # Weak contribution
      else:
        threat = 0
      
      score += threat
  
  # Apply scaling based on position diversity
  # (Moves that contribute to multiple patterns valued higher)
  pattern_count = CountMonomialsAffected(position)
  score *= (1 + 0.1 * pattern_count)
  
  RETURN score
```

### Threat Sequence Evaluation

```
EvaluateForcingSequence(start_move, board_state, depth):
  
  IF depth == 0:
    RETURN board_evaluation(board_state)
  
  IF opponent_can_win_immediately():
    RETURN -∞  (Path leads to loss)
  
  IF I_can_win_immediately():
    RETURN +∞  (Path leads to win)
  
  // Recursive minimax
  score = -∞
  
  FOR each opponent_move in opponent_responses:
    opponent_options = GenerateMoves(board_state_after_opponent_move)
    opponent_best = -∞
    
    FOR each my_move in opponent_options:
      future_value = EvaluateForcingSequence(my_move, updated_board, depth-1)
      opponent_best = max(opponent_best, future_value)
    
    score = max(score, -opponent_best)
  
  RETURN score
```

### Combo Scoring

```
EvaluateCombo(trigger_position, board_state):
  
  // Combo = two threats on different orientations
  // that both become critical when trigger is played
  
  IF placing stone at trigger creates:
    - Two independent threats with disjoint defenses
    - Both threats are S3 or better
    
    THEN score = 10000 (Highest priority)
    
  IF placing stone creates:
    - One independent threat
    - One supportive pattern
    
    THEN score = 1000
    
  RETURN score
```

### Opening Move Heuristic

```
EvaluateOpeningPosition(position, move_number):
  
  IF move_number == 1:  // First black move
    distance_to_center = ChessboardDistance(position, center)
    IF distance_to_center <= 3:
      RETURN 100  // Center advantage
    ELSE:
      RETURN 50   // Off-center playable
  
  IF move_number <= 4:  // Opening phase
    // Prefer positions that allow flexible development
    
    flexibility_score = 0
    
    FOR each possible follow-up move:
      number_of_patterns_created += 1
    
    flexibility_score = number_of_patterns_created
    
    // Avoid too-close clustering
    nearest_own_stone = FindNearestOwnStone(position)
    distance = ChessboardDistance(position, nearest_own_stone)
    
    IF distance < 2:
      flexibility_score -= 50  // Too close, limits future moves
    ELIF distance >= 3:
      flexibility_score += 10  // Good separation
    
    RETURN flexibility_score
```

---

## SEARCH ALGORITHMS

### Minimax with Alpha-Beta Pruning

```
FUNCTION Minimax(state, depth, alpha, beta, maximizing_player):
  
  IF depth == 0 OR game_over(state):
    RETURN EvaluateBoard(state)
  
  IF maximizing_player (My turn):
    max_eval = -∞
    
    FOR each move in legal_moves(state):
      new_state = ApplyMove(state, move)
      eval = Minimax(new_state, depth-1, alpha, beta, FALSE)
      max_eval = max(max_eval, eval)
      alpha = max(alpha, eval)
      
      IF beta <= alpha:
        BREAK  // Beta cutoff
    
    RETURN max_eval
  
  ELSE (Opponent's turn):
    min_eval = +∞
    
    FOR each move in legal_moves(state):
      new_state = ApplyMove(state, move)
      eval = Minimax(new_state, depth-1, alpha, beta, TRUE)
      min_eval = min(min_eval, eval)
      beta = min(beta, eval)
      
      IF beta <= alpha:
        BREAK  // Alpha cutoff
    
    RETURN min_eval
```

### Monte Carlo Tree Search (MCTS)

```
FUNCTION MCTS_SelectMove(board_state, my_color, simulations=10000, time_limit=5):
  
  root = CreateNode(board_state)
  
  FOR i in range(simulations):
    IF TimeExpired(time_limit):
      BREAK
    
    // Phase 1: Selection
    node = root
    WHILE node is not terminal AND node has all children expanded:
      node = SelectChildByUCT(node)  // Upper Confidence Bounds
    
    // Phase 2: Expansion
    IF node is not terminal AND node not fully explored:
      node = ExpandNewChild(node)
    
    // Phase 3: Simulation
    game_result = PlayoutRandom(node.state, my_color)
    
    // Phase 4: Backpropagation
    WHILE node is not null:
      node.visits += 1
      IF game_result == my_color:
        node.wins += 1
      ELSE:
        node.wins -= 1
      
      node = node.parent
  
  // Select move with best win rate
  best_child = argmax(child in root.children, child.wins / child.visits)
  RETURN best_child.move
```

---

## IMPLEMENTATION CHECKLIST FOR BOT

### Must-Implement Components
- [ ] Board state representation
- [ ] Legal move generation (smart region-based)
- [ ] Pattern detection engine (5 core patterns minimum)
- [ ] Threat scoring system
- [ ] Combo detection
- [ ] Priority-based move selection
- [ ] Minimax with Alpha-Beta (depth 4-6)

### Should-Implement Components
- [ ] MCTS for deeper search
- [ ] Opening book (first 3 moves)
- [ ] Endgame solver for forced sequences
- [ ] Transposition tables
- [ ] Move ordering heuristics

### Can-Implement Later
- [ ] Neural network evaluation
- [ ] Self-play training
- [ ] Deep MCTS integration
- [ ] Advanced opening theory

---

## PERFORMANCE OPTIMIZATION TIPS

1. **Use Bitboards** for position representation (64-bit integers)
   - Fast pattern matching via bitwise operations
   - Compact memory storage

2. **Implement Transposition Tables**
   - Store previously evaluated positions
   - Reuse results from symmetric positions

3. **Move Ordering**
   - Evaluate moves affecting threats first
   - Improves alpha-beta cutoff rate

4. **Lazy Evaluation**
   - Score only top-K candidate moves deeply
   - Use quick heuristics for others

5. **Parallel Search**
   - Multi-threaded move evaluation
   - MCTS can naturally parallelize

---

## EXAMPLE: Complete Move Decision

```
Scenario: Mid-game position
My color: Black
Opponent: White

Step 1: Threat Scan
- Found: S3 (mine), W3 (opponent)
- No immediate S4 or D4

Step 2: Apply Hierarchy
Priority 1 (Immediate wins): None
Priority 2 (Defense): White has W3
  → Must defend one end (2 possible moves)
  → But check if can create forcing sequence instead

Priority 3 (Forcing threats): 
  → Check if placing black stone at position X creates
     forcing sequence deeper than opponent's threat

Priority 4: Evaluation
  Position A: Creates S3, blocks opponent S3 → Score 80
  Position B: Creates W3, forces response → Score 75
  Position C: Defensive only → Score 30

Step 3: Deep Search
  Run minimax(depth=5) on top 3 positions
  
  Minimax eval:
  Position A: +15 (good)
  Position B: +8 (okay)
  Position C: -30 (bad)

Decision: Play Position A
```

---

## REFERENCES & SOURCES

1. **Allis, L.V. et al.** - "Go-Moku and Threat-Space Search" (1993)
2. **Wang, Y.** - "Mastering the Game of Gomoku without Human Knowledge" (2018)
3. **Piazzo, L., Scarpiniti, M., Baccarelli, E.** - "Gomoku: analysis of the game and of the player Wine" (2021)
4. **Garcia, O.** - "A Mathematical Approach to Gomoku" (2020)
5. **Jimbo, S.** - "Strategy for Five in a Row on small boards" (2014)

---

## FINAL NOTES

This strategy document combines:
- Academic research on threat-space search
- Pattern-based evaluation from Wine player
- Algebraic monomial approach from Garcia's thesis
- Deep learning insights from AlphaGo-inspired approaches
- Traditional minimax and MCTS algorithms

The bot is guaranteed to play at competitive level if:
1. All Priority 1-3 components are correctly implemented
2. Move generation focuses on region of interest
3. Pattern detection covers S3, S4, D3, D4 minimum
4. Search depth is 6+ for midgame positions

Good luck! 🎯
