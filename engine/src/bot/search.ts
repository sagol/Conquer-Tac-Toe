// engine/src/bot/search.ts: negamax with alpha-beta and iterative deepening over in-place play and undo on any
// Searchable (7.3). It knows no game: an Outcome scores a terminal, only a change of seat negates a child, and nodes,
// counted per play, are the only budget, so it never reads a clock.
import type { Move, Searchable, Seat } from '../game.ts';

const WIN = 2000; // a win scores WIN less its distance in plies (WIN with wdl), a loss the negation; evaluate() < 1
const MATE = 1000; // scores this far from zero are wins and losses
const EPS = 1e-9; // root windows open this far below the score they compare with, so ties come back exact
const EXACT = 1;
const LOWER = 2;
const UPPER = 3;
const GENS = 1 << 22; // generation stamps before the shared table is wiped and they start again

// A transposition table in typed arrays; an entry counts only while its generation is the table's.
function table(bits: number) {
  const n = 1 << bits;
  const values = new Float64Array(n); // wins and losses counted from the entry's position
  const moves = new Int32Array(n);
  const meta = new Uint32Array(n); // generation << 10 | depth << 3 | proved << 2 | bound
  return { bits, gen: 1, keys: new Float64Array(n), values, moves, meta };
}
type Table = ReturnType<typeof table>;
let shared: Table | undefined; // the isolate's table: 2^19 entries of 24 bytes, 12 MB, made by the first call
const kept = new Map<number, Table>(); // tables that the table option keeps across calls (tools/book.ts)

// The slot of a key below 2^53: its two 32-bit halves mixed, then the top bits.
const slot = (key: number, bits: number) =>
  Math.imul((key % 4294967296) ^ Math.imul(Math.floor(key / 4294967296), 0x9e3779b1), 0x85ebca6b) >>> (32 - bits);

export function search<S extends Searchable>(
  s: S,
  o: {
    depth: number;
    nodes: number;
    key?(s: S): number;
    evaluate?(s: S): number;
    margin?: number; // best also holds unproven root moves within margin; never widens a proved win
    wdl?: boolean; // callers pass Bot.wdl
    table?: number; // log2 entries kept across calls; tools/book.ts only
  },
): { best: Move[]; value: number; exact: boolean; nodes: number } {
  const t = (o.table ? kept.get(o.table) : shared) ?? table(o.table ?? 19);
  if (o.table) kept.set(o.table, t);
  else shared = t;
  if (!o.table && ++t.gen === GENS) {
    t.meta.fill(0);
    t.gen = 1;
  }
  const { key, evaluate } = o;
  const wdl = Boolean(o.wdl);
  let count = 0;
  let stopped = false;
  let proved = false; // whether the value the last node returned rests on terminals alone, no cut or evaluate()

  // The score of an ended game for `me`, `ply` plies below the root.
  const end = (winner: Seat | null, me: Seat, ply: number) =>
    winner === null ? 0 : (winner === me ? 1 : -1) * (wdl ? WIN : WIN - ply);
  // Each move's child, scored for `me`: a terminal from its Outcome, the same seat again with the same window and no
  // negation, the other seat negated.
  const child = (m: Move, me: Seat, depth: number, alpha: number, beta: number, ply: number) => {
    count++;
    s.play(m);
    const next = s.turn();
    let v: number;
    if (typeof next === 'object') {
      v = end(next.winner, me, ply + 1);
      proved = true;
    } else v = next === me ? nega(depth - 1, alpha, beta, ply + 1) : -nega(depth - 1, -beta, -alpha, ply + 1);
    s.undo();
    return v;
  };

  // Negamax on s, a position that has not ended, for the seat to move; fail-soft, so a value at or below alpha is an
  // upper bound and one at or above beta a lower bound. A cut-short node returns with nothing stored.
  function nega(depth: number, alpha: number, beta: number, ply: number): number {
    const most = wdl ? WIN : WIN - ply - 1; // a win with the next move is the most this node can score
    if (beta > most) beta = most;
    if (alpha >= beta) {
      proved = true; // nothing here can beat alpha, which is a true upper bound
      return beta;
    }
    const k = key?.(s);
    const i = k === undefined ? -1 : slot(k, t.bits);
    let first = -1;
    if (k !== undefined && t.meta[i] >>> 10 === t.gen && t.keys[i] === k) {
      const meta = t.meta[i];
      const v = t.values[i] - (!wdl && Math.abs(t.values[i]) >= MATE ? Math.sign(t.values[i]) * ply : 0);
      const bound = meta & 3;
      // A proved entry holds at any depth: it came from terminals alone.
      if (
        (meta & 4 || ((meta >> 3) & 127) >= depth) &&
        (bound === EXACT || (bound === LOWER ? v >= beta : v <= alpha))
      ) {
        proved = (meta & 4) !== 0;
        return v;
      }
      first = t.moves[i];
    }
    if (depth === 0) {
      proved = false;
      return evaluate ? evaluate(s) : 0;
    }
    const me = s.turn() as Seat;
    const moves = s.moves().slice();
    const at = moves.indexOf(first);
    if (at > 0) [moves[0], moves[at]] = [first, moves[0]];
    const floor = alpha;
    let top = -Infinity;
    let topMove = moves[0];
    let all = true;
    let bound = UPPER;
    for (const m of moves) {
      if (count >= o.nodes) stopped = true;
      if (stopped) return 0;
      const v = child(m, me, depth, alpha, beta, ply);
      if (stopped) return 0;
      if (v > top) [top, topMove] = [v, m];
      if (v > alpha) alpha = v;
      if (alpha >= beta) {
        bound = LOWER; // proved stays the cutting child's
        break;
      }
      all &&= proved;
    }
    if (bound === UPPER) {
      proved = all;
      if (top > floor) bound = EXACT;
    }
    if (k !== undefined) {
      t.keys[i] = k;
      t.values[i] = top + (!wdl && Math.abs(top) >= MATE ? Math.sign(top) * ply : 0);
      t.moves[i] = topMove;
      t.meta[i] = (t.gen << 10) | (Math.min(depth, 127) << 3) | (proved ? 4 : 0) | bound;
    }
    return top;
  }

  // Iterative deepening at the root. Every root move gets a window that opens just below the floor, the top value
  // less the margin, so moves at or above it come back exact and the rest as upper bounds. A win, which only a forced
  // line can score, makes the root exact and ends the search at once, with the winning moves found so far; otherwise
  // the root is exact when every root move is proved.
  let order = s.moves().slice();
  let result = { best: order.slice(), value: 0, exact: false }; // until an iteration completes
  const margin = o.margin ?? 0;
  // Without evaluate() every cut scores 0, so flat iterations past a few plies cost more than the full-depth one
  // that proves the result: such a search deepens to 4 plies, a fallback when the nodes run out, then takes the depth.
  for (let depth = 1; depth <= o.depth; depth = evaluate || depth < 4 ? depth + 1 : Math.max(depth + 1, o.depth)) {
    const me = s.turn() as Seat;
    const values: number[] = [];
    const proofs: boolean[] = [];
    let top = -Infinity;
    for (const m of order) {
      if (count >= o.nodes) stopped = true;
      if (stopped) break;
      values.push(child(m, me, depth, top - margin - EPS, wdl ? WIN : WIN - 1, 0));
      proofs.push(proved);
      if (stopped) break;
      top = Math.max(top, values[values.length - 1]);
      if (top >= MATE) break;
    }
    if (stopped) break;
    const best = order.filter(
      (_, j) => j < values.length && (values[j] === top || (top < MATE && !proofs[j] && values[j] >= top - margin)),
    );
    result = { best: best.sort((a, b) => a - b), value: top, exact: top >= MATE || proofs.every(Boolean) };
    if (result.exact) break;
    order = order
      .map((m, j) => [m, values[j]] as const)
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);
  }
  return { ...result, nodes: count };
}
