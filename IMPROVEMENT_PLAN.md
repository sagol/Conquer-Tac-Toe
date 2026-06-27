# Conquer-Tac-Toe — Improvement Plan

> Deletion-first. Every item = path + action + honest net-LOC. No new files, folders, hooks, base
> classes, or tests unless they provably net-remove code (and then the delta is stated).

## 1. Executive summary

The code works but is padded with dead files, copy-paste, debug logging, committed binary data, and a
few real bugs. The fix is almost entirely **deletion**.

**Biggest single win:** untrack + delete `clickhouse_data/` (**~102 MB / 4,750 tracked files**), the
loose `test_*/verify_*` scripts (**1,213 LOC**), and the dead frontend/backend/python files.

**Git facts (affect *how* you delete):** `.git` is at `Conquer-Tac-Toe/Conquer-Tac-Toe/.git`.
- `clickhouse_data/` (4,750 files) and 5 gomoku PDFs **are tracked** → `git rm -r --cached` + `.gitignore`,
  then `git filter-repo`/BFG if you want them out of history.
- **Untracked, plain `rm`:** `error.log`/`combined.log`, `.env`, `.DS_Store`, admin `frontend/build/`.
- `secret/` sits at the **workspace root, outside the repo** — never committed, but live plaintext creds. **Rotate.**

**Honest reduction estimate:**

| Category | Reduction |
|---|---|
| Committed data/binaries (clickhouse_data + 5 gomoku PDFs) | **~104 MB** (untrack + optional history rewrite) |
| Source LOC — P0 (1,395 loose scripts + 129 backend + 131 frontend + 394 python/seed) | **2,049** |
| Source LOC — P1 (Docker UI 680, hard_bot 250, log strip 155, DRY 48, comments 15, prop-types 9) | **~1,157** |
| **Source LOC subtotal (P0+P1)** | **~3,200** |
| Doc LOC (delete 3 stale docs + dup GAME_RULES + trim strategy doc) | **−1,215** |
| **Combined source + doc** | **~4,400 LOC** |
| npm deps | **−1** (`body-parser`); `prop-types` usage deleted, never declared |

**Three data bugs + the auth hole to fix regardless** (§5): rematch `gameId` type mismatch (B1),
duplicate DB pool (B2), broken active-games count (B3), admin no-auth (S1).

**Leave alone (verified correct):** `GamePage.js` derives `winner`/`isDraw` from props correctly;
`MoveTimer.js` is fine; the Gomoku strategy doc has real reasoning (trim, don't delete).

---

## 2. Quick wins (do first)

Run from repo root `Conquer-Tac-Toe/Conquer-Tac-Toe`.

| # | Action | Saves |
|---|---|---|
| Q1 | `git rm -r --cached …/conquertactoe-autoplayer/clickhouse_data && rm -rf` it + `.gitignore` | **102 MB** |
| Q2 | `git rm -r --cached …/bots/gomoku/pdf && rm -rf` it (5 tracked PDFs) | **~1.9 MB** |
| Q3 | `rm conquertactoe/admin-dashboard/backend/{error,combined}.log` (untracked) | 27 KB |
| Q4 | `find . -name .DS_Store -delete` | — |
| Q5 | `git rm conquertactoe/conquertactoe-backend/{test_*,verify_*}.js` (8 files) | **1,213 LOC** |
| Q6 | `git rm ui-dropdown-test.js manual_verification.sh` + drop `test:ui*` from root `package.json` | **182 LOC** |
| Q7 | **Rotate the Google OAuth secret, then `rm -rf` the workspace-root `secret/`** | — |

> **History note (Q1/Q2):** `git rm --cached` stops tracking but blobs stay in history (still ~102 MB
> on clone). To actually shrink: `git filter-repo --path …/clickhouse_data --path …/gomoku/pdf
> --invert-paths` after coordinating (rewrites SHAs). P2.

**Q7 — secrets.** `secret/client_secret_*.json` and `conquertactoe-backend/.env:30` both hold the live
`GOCSPX-…`. Nothing is committed, but it's plaintext on disk. Rotate in Google Cloud Console, then
`rm -rf` the workspace-root `secret/` (incl. the stray `gurudo.rtf`). Keep the secret only in `.env`.

**Q1 risk:** real ClickHouse volume. Confirm Docker recreates it from `conquertactoe-db/init` (or archive) before deleting.

**`.gitignore` (the only additive item — it prevents re-committing the 102 MB):** 6 dirs lack one.
Add to: `conquertactoe-backend`, `conquertactoe-frontend`, `conquertactoe-db`, `admin-dashboard/backend`,
`admin-dashboard/frontend` (`node_modules/ *.log .DS_Store .env build/`), and `conquertactoe-autoplayer`
(`__pycache__/ *.pyc .venv/ clickhouse_data/`). `admin-dashboard/` already has one.

---

## 3. Codebase reduction (delete / collapse)

### 3a. Dead code — pure deletion (no behavior change)

**Backend**

| File / location | Action | LOC |
|---|---|---|
| `backend/src/models/GameMove.js` | Delete — zero imports; moves go to ClickHouse | 16 |
| `routes/testRoutes.js` + `controllers/testController.js` + `utils/testGameUtils.js` | Delete — `/test-db` never mounted | 38 |
| `utils/gameUtils.js:42-116` `checkGameOverConditionLegacy` | Delete the 75-line 3×3-hardcoded fallback. **Do NOT convert the line-31 catch to a `throw`** blindly — it wraps the whole try (incl. `hasValidMoves` + variant fetch); callers use `gameOverCondition?.winner`. Keep returning `null` on error. | 75 |

Backend dead-code subtotal: **−129**.

**Frontend** (all six confirmed, zero imports)

| File | Why dead | LOC |
|---|---|---|
| `src/redux/reducers/index.js` | Imports non-existent `gamesReducer`; store uses `rootReducer.js` | 12 |
| `src/components/Game/GameLobby.js` | Imports non-existent `gameActions`; never routed | 25 |
| `src/components/Auth/AuthWrapper.js` | Imports non-existent `fetchUserProfile`; App uses `fetchCurrentUser` | 33 |
| `src/components/Auth/GoogleLogin.js` | Stub, hardcoded `localhost:3000`; real flow in `Login.js` | 15 |
| `src/components/Auth/Logout.js` | Logout is inline in `Navbar.js` | 20 |
| `src/components/Layout/Container.js` | Trivial MUI wrapper; never imported | 8 |

Frontend dead-files subtotal: **−113**.

**GameBoard dead handlers/props** (`components/GameBoard/GameBoard.js`)

| Location | Action | LOC |
|---|---|---|
| `GameBoard.js:11` + `GamePage.js:315-316` | Remove unused props `openRematchModal`, `onClearRematchParam` | 2 |
| `GameBoard.js:92-99` + `socket.on` 103 / `socket.off` 110 | Remove `handleRematchAccepted` — `RematchModal.js:81` does the real navigation | 11 |
| `GameBoard.js:270-274` | Remove effect that only logs + unconditionally `setError(null)` (masks errors) | 5 |
| `GameBoard.js:50-77` | REST "pending rematch" fallback — **defer to P2** (works around an unidentified socket-auth bug) | (28, P2) |

GameBoard dead subtotal (excl. 50-77): **−18**.

**Python autoplayer**

| File | Action | LOC |
|---|---|---|
| `bots/gomoku/opening_book.py` | Delete — never imported; `GomokuStrategy.get_opening_move()` is live | 101 |
| `bot_analysis.py` | Delete — standalone `__main__` tournament tool, zero production wiring | 233 |

> ~~`bots/gomoku/easy_bot.py` "remove transposition_table remnants"~~ — **REFUTED, removed.** `easy_bot.py`
> has zero `transposition_table` (it's `medium_bot.py` that has it). No action.

Python dead subtotal: **−334**.

**Admin backend**

| Location | Action | LOC |
|---|---|---|
| `admin-dashboard/backend/seed_admin.js` | Delete — also deletes a dead `CREATE TABLE "AdminUsers"` (16,28,35) that the live auth path never reads (auth queries `Users`, auth.js:38). Double dead code. | 60 |

### 3b. Duplication (DRY) — collapse only where it net-removes code, no new files

| Target | Verdict | Net LOC |
|---|---|---|
| **`socket.js` `emitRematchAccepted`** 3-room emit (identical 3-line×3: 92-94, 348-350, 476-478) | Worth it **only because bundled with the B1 `parseInt` fix**. Local helper in same file. | **−4** |
| **`socket.js` `buildRematchRequestPayload`** (48-53, 291-296, 396-411) | **Do NOT extract** — blocks genuinely diverge (`parseInt(gameId)`/`pending.requesterName`/`remainingMs` vs raw `gameId`/`socket.request.user?.username \|\| 'Opponent'`/`REMATCH_TIMEOUT_MS`). A normalizing helper is net ≈0. | **0** |
| **`authController.js` ban check** (17-26, 61-70, 123-137; 3rd has extra `else`/403) | Same-file local function only, no new file. | **−12** |
| **`gameRequestController.js` variant default** — `\|\| 3` appears **8×** (lines 18,24,35,42,95,232,261,284) | Add `const DEFAULT_VARIANT_ID = 3`, one line. Removes a foot-gun. | **−2** |
| **Admin backend `new Pool` ×8** (server.js:49, passport-admin.js:5, routes/{games,users,auth,settings}.js, seed_admin.js:5*, seed_settings.js:3) | **No new `config/db.js`.** `module.exports` the existing pool from `server.js`, `require` it in the routes (`seed_admin.js` is deleted in §3a, so 7 remain). | **−10** |
| **Admin ClickHouse client** dup (server.js + analytics.js) | First check if the `server.js` instance is only the health check — if so **delete it**; else export+import from server.js. No new file. | **−10** |
| **Frontend `BACKEND_URL`** — duplicated **15** call-sites with inconsistent fallbacks (`3000` vs `5001` vs none) | Route through the **existing** `utils/api.js`. **Do NOT create `src/config.js`.** Real bug. | **−10** |

**Explicitly NOT doing (would add a file/abstraction the owner rejects):**
- ~~`bots/classic/classic_strategy.py` base class (−60)~~ — adds a file + inheritance to dedup ~42 LOC.
  **Leave the dupes** (or, if you must, put 3 free functions in an existing shared util — no class). Net banked: **0**.
- ~~Fold gomoku easy/medium into `GomokuStrategy` w/ difficulty param (−81)~~ — **factually shaky** (medium has a
  transposition_table easy lacks; minimax halves are NOT identical) and injects `if difficulty==…` branches.
  **Leave separate.** Net banked: **0**.
- ~~`utils/validation.js` for B6~~ — see B6: inline, no new module.

### 3c. Docs reduction — straight deletion, zero new folders

| File | Action | LOC |
|---|---|---|
| `PROJECT_STATUS.md` | Delete — status/version lives in git history | −415 |
| `BACKUP.md` | Delete — ops noise; the script is the source of truth | −301 |
| `TEST_SCENARIOS.md` | Delete — stale test list; tests belong in code | −83 |
| `conquertactoe/GAME_RULES.md` | Delete — dup of root `GAME_RULES.md` (84) | −37 |
| `bots/gomoku/gomoku_bot_strategy.md` (758) | **Keep, trim ~50%** — genuine reasoning | −379 |

**Keep at root, as-is:** `README.md`, `conquer-tac-toe-trd.md`, `ADMIN_GUIDE.md`, `GAME_RULES.md`.
Delete `IMPROVEMENT_PLAN.md` once executed. **No `docs/` folder.** Doc subtotal: **−1,215**.

---

## 4. Simplification (KISS) — delete, don't refactor into more files

- **`gameRequestController.js` (979).** Delete debug `console.*`, keep the 19 `console.error` → **~−54**.
  **Do not create `botMove.js`** — after the log deletion the file is no longer a god-file; the log delete is the whole win.
- **`GameBoard.js` (953).** (1) Delete ~56 debug `console.*`. (2) **Perf bug:** `isCreator`/`myPlayerNumber`
  duplicated (289-291 & 658-660), and `renderCell` rescans the whole board for `firstPlayer` (687-725) on
  *every* cell — O(cells²), ~361× on 19×19. Hoist into one `useMemo`. **Cut the "group 19 `useState` into
  custom hooks" idea** — adds files + abstraction, removes ~0 net LOC.
- **`socket.js` over-comments:** "Defensive programming" (180-187), Pros/Cons (207-213), `Set.has()` explainer
  (240-242) → one-liners → **−15**.
- **`gomoku/hard_bot.py` (837).** Overengineered (Zobrist, VCF search, killer/history, fork blocking) with
  **no telemetry**. Owner mandate = no evidence → delete. **Drop VCF + fork-block (~−250); P1, not P2.**
  Reframe from "leave it or risk it" to "delete unless someone produces evidence it helps."
- **Docker-log admin UI.** **Delete it (see S2)** — `routes/docker.js` (146) + `pages/DockerLogs.js` (423)
  + `DockerLogs.css` (111) = **~−680**. This both removes the most code and closes the worst-after-S1
  security hole. **Do not split into 3 files.** P1, after S1.

---

## 5. Correctness & bottlenecks

### Real bugs

- **B1 — CRITICAL: rematch `gameId` type mismatch (`backend/src/socket.js`).** `cleanupRematch` (20-25) +
  332/382/450/499/525 use the raw **string** key; 33/61/281 use `parseInt`. Mismatched Map keys → rematches
  silently lost. Fix: `parseInt(gameId)` once at the top of each handler. Bundle with the `emitRematchAccepted` helper (3b).
- **B2 — CRITICAL: duplicate DB pool in the game backend (`backend/src/utils/settings.js:8`).** It creates a
  *second* `new Pool({ connectionString: DATABASE_URL })` while `backend/src/config/db.js` already exports one
  (built from `POSTGRES_*`). Two pools = leaked connections and possibly a different DB target. Fix:
  `const pool = require('../config/db');` → **−4**. *(Distinct from the admin dashboard's own pool sprawl, which
  is the §3b item — don't conflate the two.)*
- **B3 — HIGH: broken active-games count (`GameRequest.js:112`).** `WHERE (creator_id=$1 OR joiner_id=$1) OR
  (status='pending')` — trailing clause has no user filter → counts *every* pending game globally → breaks
  `max_active_games_per_user`. Fix: drop `OR status='pending'`. **Leave line 60** (`getLobbyGames` intentionally shows all pending for the lobby UI).
- **B4 — HIGH: unvalidated `gameType` (`gameRequestController.js:395`).** Arbitrary `req.body.gameType` stored,
  but `Leaderboard.js:22` counts only `game_type='public'`. Add an allow-list check before insert.
- **B5 — HIGH: SQL injection in ClickHouse (`clickhouseService.js:83-100`).** `gameId` (89) and `difficulty`
  (96) interpolated raw into the query string. Escape single quotes (board already goes through `JSON.stringify`) or bind parameters.
- **B6 — passport username bypass (`passport.js:14-20`).** Inserts Google `displayName` unvalidated; `userController`
  validates `/^[a-zA-Z0-9_ -]+$/`. Fix: **import the existing `isValidUsername` from `userController`** (or inline
  the one regex where passport lives). **Do NOT create `utils/validation.js`.** Net should be ≤0.
- **B7 — redux action mismatch (`authReducer.js:20`).** `case 'LOGOUT_SUCCESS'` never fires; `logoutUser`
  dispatches `'LOGOUT_USER'`. Rename the case. Trivial.

**Explicitly NOT fixing (net-additive, low value):** wrapping raw action-type strings at `Lobby.js:92,153` in
an action creator; the speculative `useApiError` hook (~50 LOC of new indirection for a non-problem).

### Security

- **S1 — CRITICAL: admin routes have NO auth guard.** `server.js:89-95` mounts users/settings/games/analytics/system/**docker**
  with no route protection; `settings.test.js:31-36` even *expects* 401. Passport is wired for **login** only:
  `passport-admin.js` defines the `google-admin` OAuth strategy and `server.js:44-46` calls
  `passport.initialize()/session()` — but there is **no route-guard middleware**. Fix is still small: add a
  `requireAdmin(req,res,next)` (~5–8 lines: reject if `!req.user` / wrong role) and `app.use('/admin', requireAdmin)`
  **before** the mounts, leaving `/admin/auth` open. **The single most important fix in the repo.**
- **S2 — HIGH: `docker.js` exposes `docker.sock`** (4,9,44) with no auth — an unauthenticated RCE surface.
  **Delete the Docker UI** (`routes/docker.js` + `pages/DockerLogs.js` + `DockerLogs.css` = ~680 LOC). Most code
  removed *and* hole closed. **P1, depends on S1** (not P2).
- **S3 — secrets:** see Q7.

### Bottlenecks

- **Missing indexes (`init.sql`):** only `variant_id`/`bot_difficulty` indexed; `GameRequest` queries filter on
  `creator_id`, `joiner_id`, `status`, `created_at` → full scans. Add four indexes.
- **`hasValidMoves()` O(3·n²)** (`gameRules.js:212-225`) called twice unconditionally in `checkGameOverCondition`
  even when a winner is known. Short-circuit on known winner.
- **GameBoard per-cell scans:** the `useMemo` hoist in §4.

### Error-handling hygiene

- `aiService.js:28-31` swallows the axios error and throws a generic string — log `error.response?.status` + `error.message` first.

---

## 6. Dependencies & architecture

| Item | Verdict | Action |
|---|---|---|
| **MUI v4 on React 18** (`frontend/package.json`) | Real EOL risk | **Plan** a v5 migration, not now. After deletions + bug fixes. |
| **`body-parser`** (`backend/package.json`, `app.js:5,46`) | Redundant | Use `express.json()`; drop the dep. Trivial. **−1 dep.** |
| **`prop-types`** (only `SEO.js`, undeclared) | 1 component | Delete the import (line 3) + the 8-line `propTypes` block (57-64) = **9 lines**. Do *not* add the dep. |
| **Redux notifications mix** (`NotificationContext.js`) | Minor | **Skip** — moving to Redux *adds* code. |
| **Hand-written Redux / no TS** | Root cause of B7 + dead actions | **No TS now.** Deleting dead actions/components (§3a) removes most broken cases. |
| **Two backends (game + admin)** | Real duplication | **Don't merge now.** Cheap 90%: shared admin pool via `server.js` export (3b) + fix S1. |
| **5 docker-compose files** dup logging/network | Minor | Optional YAML anchors (~−30). Low priority. |

**Net dependency change: −1 (`body-parser`). None added.**

---

## 7. Prioritized roadmap

### P0 — this week (safe deletions + 3 data bugs + the auth hole)
- [ ] Q1–Q7: untrack+delete clickhouse_data, untrack+delete 5 gomoku PDFs, rm logs/`.DS_Store`, delete 8 backend
  scripts + 2 root scripts, **rotate + delete secret** → **104 MB + 1,395 LOC** (Q5 1,213 + Q6 182)
- [ ] Add `.gitignore` to the 6 dirs in §2 *(only additive item)*
- [ ] B1 rematch `parseInt` · B2 game-backend single DB pool · B3 count-query (line 112 only) · S1 admin `requireAdmin` guard
- [ ] Backend dead code: `GameMove.js`, test route/controller/utils, `checkGameOverConditionLegacy` → **−129**
- [ ] 6 frontend dead files (**−113**) + GameBoard dead handler/props/effect (**−18**) → **−131**
- [ ] `opening_book.py` (101) + `bot_analysis.py` (233) + `seed_admin.js` (60) → **−394**

**End of P0: ~104 MB + ~2,049 LOC removed (1,395 + 129 + 131 + 394); data-loss bugs + auth hole closed.**

### P1 — next (security delete, log cleanup, remaining bugs, real dedup)
- [ ] **S2: delete the Docker admin UI** (`routes/docker.js` + `pages/DockerLogs.js` + `DockerLogs.css`) → **~−680**
- [ ] **Delete `hard_bot.py` VCF + fork-block** (no telemetry justifies them) → **~−250**
- [ ] Strip debug `console.*`: gameRequestController (~54), GameBoard (~56), GamePage (~45), + admin routes → **~−155**
- [ ] B4 gameType allow-list · B5 ClickHouse escaping · B6 username validation (reuse existing) · B7 `LOGOUT_USER` rename · aiService error logging
- [ ] Real DRY (no new files): `emitRematchAccepted` (−4), authController ban check (−12), admin pool export (−10),
  admin ClickHouse (−10), `DEFAULT_VARIANT_ID` (−2), single frontend `BACKEND_URL` (−10) → **−48**
- [ ] DB indexes on GameRequests; short-circuit `hasValidMoves`; GameBoard `useMemo` hoist
- [ ] Trim `socket.js` comments (−15); drop `body-parser`; delete `prop-types` usage in `SEO.js` (−9)
- [ ] Docs: delete `PROJECT_STATUS.md` (−415), `BACKUP.md` (−301), `TEST_SCENARIOS.md` (−83), dup `GAME_RULES.md` (−37); trim `gomoku_bot_strategy.md` (−379) → **−1,215**

**End of P1: ~−1,150 source + ~−1,215 doc LOC.**

### P2 — later (larger / risky)
- [ ] `GameBoard.js:50-77` REST rematch fallback — find the socket-auth root cause first, then delete (−28)
- [ ] **MUI v4 → v5** migration (security-driven, large)
- [ ] `git filter-repo`/BFG history rewrite to shrink the 102 MB out of history (coordinate — rewrites SHAs)
- [ ] Optional: fold admin backend into main under `/admin`

---

**Total realistic reduction (P0+P1): ~104 MB of tracked binaries/data plus ~4,400 deleted lines
(~3,200 source + ~1,215 doc), fixing 7 real bugs and closing the admin auth + Docker-socket holes —
one dependency dropped, zero added, zero new files, folders, hooks, base classes, or test suites.**
