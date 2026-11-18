// engine/src/game.ts: the whole contract between the kernel and a game family (boundaries: 4.7).
export type Seat = 0 | 1; // 0 = p1 (token player/x), 1 = p2 (player/o)
export type Move = number; // family-chosen integer, 0 <= m < 2^24; leaves the engine only as name()
export type Opts = Readonly<Record<string, number>>;

export interface Outcome {
  winner: Seat | null; // null = draw; may be the seat that did not move
  reason: string; // one fixed text per ending, no digits: 'Four in a row'
  line?: readonly number[]; // cells to light in sweep order; may join several lines
}

// All the kernel search needs; a bot may hand it a faster copy of the position (Bot.fast).
export interface Searchable {
  turn(): Seat | Outcome; // seat to move (repeats after a forced pass or an extra move) or the end
  moves(): readonly Move[]; // legal moves in search order (a fast copy may list a subset); [] exactly when turn() is an Outcome; may be reused per ply, so read it fully first
  play(m: Move): void; // m from moves(); applies forced passes itself
  undo(): void; // restores the position before the last play
}

// Mutable, one owner. Room, client, replay, arena and search all use the same object.
export interface Position extends Searchable {
  name(m: Move): string; // /^[A-Za-z0-9:+-]{1,12}$/, unique within moves(); cells uppercase (6.0)
  label?(m: Move): string; // move log and live region; called before play(m); default name
  view(): View; // a fresh value per call; with turn() it fixes moves() and the result (K7)
  path(m: Move): readonly string[]; // taps that make m; prefix-free within moves()
}

export interface Piece {
  seat: Seat;
  kind: 'ring' | 'glyph' | 'stone';
  size?: 0 | 1 | 2;
} // closed set (9.3)
export interface TrayItem {
  piece: Piece;
  left: number;
  target: string;
} // only the tray of the seat to move is tappable
export interface View {
  // all the shared Board needs, and the whole visible state
  cols: number;
  rows: number; // square cells; index = row * cols + col; A1 bottom left for every viewer
  cells: readonly (Piece | null)[]; // the one visible piece of each cell
  targets?: readonly (string | null)[]; // tap target per cell; default its name 'B2'; null = inert, drawn dimmed
  tray?: readonly [readonly TrayItem[], readonly TrayItem[]]; // per seat; absent = no tray
  hint?: string; // every viewer sees it; at most 60 characters; holds any no-progress count
}
export interface Option {
  key: string;
  label: string;
  values: readonly number[];
  default: number;
}
export interface Clock {
  initialMs: number;
  incrementMs: number;
  capMs: number;
}

// Level rows are data: they survive a JSON round trip, and the arena prints tuned rows to paste.
export interface Level {
  rating: number; // display rating in this variant; level 1 near 800
  tip: string; // BOT PATTERN line
  ms: number; // p95 move-time target in workerd, at most BOT_MS; the bench sets nodes from it
  depth: number; // kernel search plies, 99 = no cap; own engines ignore it
  nodes: number; // the only work budget: search nodes or an own engine's unit
  noise: number; // chance of a random move; from level 2 never one that ends the game in the mover's loss
  margin?: number; // root moves within margin of the best are equally likely; engine's own scale
  x?: Readonly<Record<string, number>>; // hand-set knobs of a family's own engine
}
export type Five<T> = readonly [T, T, T, T, T];
export const BOT_NAMES = ['Pip', 'Echo', 'Vex', 'Nova-9', 'Omega'] as const; // D-09
export const BOT_MS = 2500; // caps every Level.ms (budget.mjs); raised only in a kernel milestone
export interface Choice {
  move: Move;
  nodes: number;
  exact: boolean; // the position's win/draw/loss value is proved and the move keeps it
  value?: -1 | 0 | 1; // that value for the side to move; set exactly when exact
}

// Loaded only through Variant.bot() by the room's bot-turn code (worker/src/bot.ts), the arena and tools/book.ts; never in the browser.
export interface Bot<P extends Position = Position> {
  fast?(p: P): Searchable; // faster copy for search, book probe and trap rule (K15): p's move integers, a subset of p's moves keeping every win in one and the value
  key?(s: Searchable): number; // on fast(p), else p: < 2^53, side to move and counters included; may fold symmetries; exact wherever ceiling() is 'exact', else may be a hash
  evaluate?(s: Searchable): number; // on fast(p), else p; side to move, in (-1, 1); also the arena's Greedy
  wdl?: boolean; // the search scores win/draw/loss without distance (games that always end)
  book?: string; // proved (key, win/draw/loss) entries from tools/book.ts; depth-99 rows
  choose?(p: P, row: Level, rng: () => number): Choice | undefined; // own engine after the win and noise steps; undefined hands the row to the kernel search
}

// One registry entry = one arena card = one games.variant value.
export interface Variant<P extends Position = Position> {
  id: string; // /^[a-z0-9]{2,16}$/, permanent once live: D1, URLs, Hub keys
  title: string;
  line: string; // arena card
  tone: 'x' | 'o' | 'lime'; // chip colour: token player/x, player/o or accent/lime
  rules: readonly { text: string; moves?: string }[]; // How to play; moves draw a board
  options: readonly Option[]; // Create dialog and API check; [] when none
  clock: Clock; // live preset; the kernel adds Relaxed (D-07)
  preview: string; // move names for the card's mini board
  levels: Five<Level>; // calibrated at the default options
  status: 'hidden' | 'live' | 'retired'; // D-21
  ceiling(o: Opts): 'exact' | 'search'; // level 5 under these options (6.n): gate profile, Create dialog note
  start(o: Opts): P; // throws RangeError on a bad option mix
  bot(): Promise<Bot<P>>; // dynamic import inside the family folder; a stub in the web build
}
