# Conquer-Tac-Toe Test Scenarios

## 1. Backend Test Scenarios

### 1.1 Game Creation
- **TC-BE-01**: Create Classic Tic-Tac-Toe Game
  - **Input**: `POST /game-requests`, `variantId: 1`
  - **Expected**: Game created with `board_size: 3`, `player1_cones: [1,1,1]`, `allowOverwrite: false`
- **TC-BE-02**: Create Gomoku Game
  - **Input**: `POST /game-requests`, `variantId: 2`
  - **Expected**: Game created with `board_size: 15` (default), `player1_cones: [999]`, `allowOverwrite: false`
- **TC-BE-03**: Create Conquer Classic Game
  - **Input**: `POST /game-requests`, `variantId: 3`
  - **Expected**: Game created with `board_size: 3`, `player1_cones: [3,3,2]`, `allowOverwrite: true`

### 1.2 Bot Integration
- **TC-BE-04**: Bot Move - Classic Tic-Tac-Toe
  - **Setup**: Active game, variant 1, player 2 turn (bot)
  - **Action**: Call `/move` endpoint on AI service
  - **Expected**: Bot returns valid move (row, col) for 3x3 board. No cone size logic used.
- **TC-BE-05**: Bot Move - Gomoku
  - **Setup**: Active game, variant 2, player 2 turn (bot)
  - **Action**: Call `/move` endpoint on AI service
  - **Expected**: Bot returns valid move for 15x15 board.
- **TC-BE-06**: Bot Move - Conquer
  - **Setup**: Active game, variant 3, player 2 turn (bot)
  - **Action**: Call `/move` endpoint on AI service
  - **Expected**: Bot returns valid move with `cone_size`.

### 1.3 Game Logic & Win Conditions
- **TC-BE-07**: Win Condition - Classic 3-in-row
  - **Setup**: Board has 2 Xs in a row, player places 3rd X
  - **Expected**: Game status updates to `won`, winner is player 1.
- **TC-BE-08**: Win Condition - Gomoku 5-in-row
  - **Setup**: Board has 4 stones in a row, player places 5th
  - **Expected**: Game status updates to `won`.
- **TC-BE-09**: Overwrite Rule - Conquer Classic
  - **Setup**: Player tries to place Large cone on Small cone
  - **Expected**: Move accepted.
  - **Setup**: Player tries to place Small cone on Large cone
  - **Expected**: Move rejected.

---

## 2. UI Test Scenarios

### 2.1 Navigation & Rules
- **TC-UI-01**: Navigate to Rules Page
  - **Action**: Click "Rules" in Navbar
  - **Expected**: Rules page loads, showing all 5 variants.
- **TC-UI-02**: Home Page Links
  - **Action**: Click "View Full Rules" on Home page
  - **Expected**: Navigate to Rules page.

### 2.2 Game Creation Modal
- **TC-UI-03**: Variant Selection - Classic
  - **Action**: Select "Classic Tic-Tac-Toe"
  - **Expected**: Description shows "No Overwrite", Board 3x3.
- **TC-UI-04**: Variant Selection - Gomoku
  - **Action**: Select "5-in-Line"
  - **Expected**: Board size dropdown appears (10x10, 15x15, etc.).
- **TC-UI-05**: Variant Selection - Conquer Custom
  - **Action**: Select "Conquer Custom"
  - **Expected**: Custom cone input fields appear.

### 2.3 Game Board UI
- **TC-UI-06**: Classic Board Display
  - **Setup**: Start Classic game
  - **Expected**: No cone selection buttons at bottom. Grid is 3x3.
- **TC-UI-07**: Gomoku Board Display
  - **Setup**: Start Gomoku game
  - **Expected**: No cone selection buttons. Grid is 15x15 (or selected size).
- **TC-UI-08**: Conquer Board Display
  - **Setup**: Start Conquer game
  - **Expected**: Cone selection buttons visible with counts.

### 2.4 Gameplay
- **TC-UI-09**: Play Move - Classic
  - **Action**: Click empty cell
  - **Expected**: X/O placed immediately. Turn switches.
- **TC-UI-10**: Play Move - Conquer
  - **Action**: Select cone size, click cell
  - **Expected**: Cone placed. Inventory count decreases.
