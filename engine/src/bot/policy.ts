// engine/src/bot/policy.ts: chooseMove, the one bot policy of 7.3 for every game and level. A level changes only the
// parameters of its row; the steps run in order and the first that yields moves ends the call.
import type { Bot, Choice, Move, Position, Searchable, Variant } from '../game.ts';
import { random } from '../random.ts';
import { search } from './search.ts';

type Value = -1 | 0 | 1;
// The moves a level may play at a position, before the random pick, and what a Choice of any of them carries.
type Plays = Omit<Choice, 'move'> & { moves: readonly Move[] };

const books = new Map<string, Map<number, number>>(); // each Bot.book decoded once per isolate

// A book is three lists of keys, for the values -1, 0 and 1, joined by ';'; each list is sorted and written as
// base-36 differences joined by ','.
function decode(book: string): Map<number, number> {
  const out = new Map<number, number>();
  book.split(';').forEach((list, i) => {
    let key = 0;
    for (const step of list ? list.split(',') : []) {
      key += Number.parseInt(step, 36);
      out.set(key, i - 1);
    }
  });
  books.set(book, out);
  return out;
}

// Win in one, noise, book probe, the bot's own engine, then the kernel search on the fast copy or the position.
// Noise yields the moves its random pick draws from. `table` keeps a search table across calls (tools/book.ts only).
export function plays(
  v: Variant,
  b: Bot,
  p: Position,
  level: 1 | 2 | 3 | 4 | 5,
  rng: () => number,
  table?: number,
): Plays {
  const row = v.levels[level - 1];
  const s = b.fast?.(p) ?? p;
  const me = s.turn();
  if (typeof me === 'object') throw new RangeError('no move to choose: the game is over');
  let nodes = 0;
  // Every step spends the row's nodes one play at a time and stops when they run out.
  let short = false;
  const spend = () => {
    if (nodes >= row.nodes) short = true;
    else nodes++;
    return !short;
  };
  // The value for me of a game that has ended, else undefined.
  const ended = (q: Searchable): Value | undefined => {
    const t = q.turn();
    return typeof t !== 'object' ? undefined : t.winner === null ? 0 : t.winner === me ? 1 : -1;
  };
  // The moves of q after which `keep` holds, as many as the nodes allow.
  const where = (q: Searchable, keep: (q: Searchable) => boolean) =>
    [...q.moves()].filter((m) => {
      if (!spend()) return false;
      q.play(m);
      const ok = keep(q);
      q.undo();
      return ok;
    });

  if (level > 1) {
    const wins = where(s, (q) => ended(q) === 1);
    if (wins.length) return { moves: wins, nodes, exact: true, value: 1 };
  }
  if (rng() < row.noise) {
    const safe = level > 1 ? where(p, (q) => ended(q) !== -1) : [];
    return { moves: safe.length ? safe : [...p.moves()], nodes, exact: false };
  }

  // After one of my moves: my value, the worst reply for me, and the replies that do not lose for the seat turn()
  // names next (none when I move again). `leaf` values the positions where I move; the other seat's replies are
  // opened. Undefined when a leaf is.
  let leaf: (q: Searchable) => number | undefined;
  const after = (q: Searchable): [number, number] | undefined => {
    const t = q.turn();
    if (typeof t === 'object' || t === me) {
      const x = ended(q) ?? leaf(q);
      return x === undefined ? undefined : [x, 0];
    }
    let worst = 1;
    let safe = 0;
    for (const r of [...q.moves()]) {
      if (!spend()) return undefined;
      q.play(r);
      const x = ended(q) ?? (q.turn() === me ? leaf(q) : after(q)?.[0]);
      q.undo();
      if (x === undefined) return undefined;
      worst = Math.min(worst, x);
      if (x <= 0) safe++;
    }
    return [worst, safe];
  };
  // The moves whose cost, read from `after`, is least; an undefined cost leaves a move out, and running out of nodes
  // leaves none. Level 5 counts the safe replies (the trap rule); other levels give every kept move the same cost.
  const least = (moves: readonly Move[], want?: number) => {
    const out: Move[] = [];
    let low = Infinity;
    for (const m of moves) {
      if (!spend()) return [];
      s.play(m);
      const a = after(s);
      s.undo();
      if (!a || (want !== undefined && a[0] !== want)) continue;
      const cost = level === 5 ? a[1] : 0;
      if (cost < low) out.length = 0;
      low = Math.min(low, cost);
      if (cost === low) out.push(m);
    }
    return out;
  };

  const { key, book } = b;
  if (row.depth === 99 && book && key) {
    const known = books.get(book) ?? decode(book);
    const value = known.get(key(s)) as Value | undefined;
    leaf = (q) => known.get(key(q));
    // Only the move tools/book.ts walked, or its mirror, has every reply in the book.
    const kept = value === undefined ? [] : least([...s.moves()], value);
    if (kept.length) return { moves: kept, nodes, exact: true, value };
  }
  const own = b.choose?.(p, row, rng);
  if (own) return { moves: [own.move], nodes: nodes + own.nodes, exact: own.exact, value: own.value };

  const o = { depth: row.depth, key, evaluate: b.evaluate, wdl: b.wdl, table };
  const r = search(s, { ...o, nodes: row.nodes - nodes, margin: row.margin });
  nodes += r.nodes;
  const value = (Math.sign(r.value) + 0) as Value; // + 0 turns a drawn -0 into 0
  // The trap rule, on an exact result without margin: under a win every reply loses, so only draws and losses
  // count; under a loss it is a swindle that keeps the moves leaving the other seat the fewest replies that do not
  // lose for it. It spends only the nodes left, its searches keep what this choice proved so far, and it keeps the
  // random pick when the nodes run out.
  if (level === 5 && r.exact && !row.margin && value < 1 && r.best.length > 1) {
    leaf = (q) => {
      const x = search(q, { ...o, nodes: row.nodes - nodes, keep: true });
      nodes += x.nodes;
      short ||= !x.exact;
      return Math.sign(x.value);
    };
    const kept = least(r.best);
    if (!short) return { moves: kept, nodes, exact: true, value };
  }
  return { moves: r.best, nodes, exact: r.exact, ...(r.exact && { value }) };
}

// The level's move at p: a pure function of the position, the level and the seed (K12).
export function chooseMove(v: Variant, b: Bot, p: Position, level: 1 | 2 | 3 | 4 | 5, seed: number): Choice {
  const rng = random(seed);
  const r = plays(v, b, p, level, rng);
  const move = r.moves[Math.floor(rng() * r.moves.length)];
  return { move, nodes: r.nodes, exact: r.exact, ...(r.exact && { value: r.value }) };
}
