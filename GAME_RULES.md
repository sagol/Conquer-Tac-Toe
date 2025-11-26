# Conquer-Tac-Toe Game Rules

## Overview
Conquer-Tac-Toe offers 5 exciting game variants, ranging from classic strategy to complex tactical battles with cone sizes.

---

## 1. Classic Tic-Tac-Toe
**The traditional game you know and love.**

- **Board Size**: 3x3
- **Pieces**: X and O (represented by simple markers)
- **Goal**: Get **3 in a row** (horizontal, vertical, or diagonal)
- **Special Rules**: 
  - No cone sizes
  - No overwriting allowed
  - Once a piece is placed, it stays there

---

## 2. 5-in-Line (Gomoku)
**A larger scale strategy game.**

- **Board Size**: 15x15 (Standard), options for 10x10 to 19x19
- **Pieces**: Black and White stones
- **Goal**: Get **5 in a row** (horizontal, vertical, or diagonal)
- **Special Rules**:
  - No cone sizes
  - No overwriting allowed
  - First player to get exactly 5 in a row wins

---

## 3. Conquer-Tac-Toe (Classic)
**The signature game mode with tactical depth.**

- **Board Size**: 3x3
- **Pieces**: Cones of 3 sizes (Small, Medium, Large)
- **Starting Inventory**: Each player has 3 Small, 3 Medium, 2 Large cones
- **Goal**: Get **3 in a row** of your color
- **Special Rules**:
  - **Overwriting**: You can place a cone on top of an existing cone (yours or opponent's) ONLY if your cone is **LARGER** than the existing one.
  - *Example*: A Large cone can cover a Medium or Small cone. A Medium cone can cover a Small cone.
  - Once covered, the cone underneath no longer counts towards a win until revealed.

---

## 4. Conquer-Tac-Toe (Same-Size Replace)
**An advanced variant with more aggressive play.**

- **Board Size**: 3x3
- **Pieces**: Cones of 3 sizes
- **Starting Inventory**: 3 Small, 3 Medium, 2 Large
- **Goal**: Get **3 in a row**
- **Special Rules**:
  - **Overwriting**: You can place a cone on top of an existing cone if yours is **LARGER OR EQUAL SIZE**.
  - *Example*: A Medium cone can cover another Medium cone (or Small).
  - This makes the game much more dynamic as positions change frequently.

---

## 5. Conquer-Tac-Toe (Custom)
**Customize your strategy.**

- **Board Size**: 3x3
- **Pieces**: Cones of 3 sizes
- **Starting Inventory**: You choose! (Max 5 of each size)
- **Goal**: Get **3 in a row**
- **Special Rules**:
  - **Overwriting**: Standard rules (Larger covers Smaller)
  - Players configure their cone inventory before the game starts.
  - Create unique strategies: Rush with many small cones? Or dominate with many large ones?

---

## Win Conditions Summary

| Variant | Board | Win Condition | Overwrite Rule |
|---------|-------|---------------|----------------|
| Classic Tic-Tac-Toe | 3x3 | 3 in a row | ❌ None |
| Gomoku | 15x15 | 5 in a row | ❌ None |
| Conquer Classic | 3x3 | 3 in a row | ✅ Larger Only |
| Conquer Same-Size | 3x3 | 3 in a row | ✅ Larger or Equal |
| Conquer Custom | 3x3 | 3 in a row | ✅ Larger Only |
