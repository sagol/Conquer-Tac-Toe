// budget: 810 lines, 200 KB
// Gomoku's own engine (7.3): the pattern board as the fast copy, its key and evaluation, and choose(), which runs the
// fixed decision order. A level's knobs sit in its row's x: `vcf` and `vct` are the plies of the threat searches (0 or
// absent: none), `top` the number of best moves a top-pick level values and `wide` its chance of a random pick among
// them, `raw` a level whose root list is every cell near a stone, with no forced move kept apart, and `open` a level
// that plays the opening data. A row without x leaves the move to the policy's kernel search (the arena's Greedy).
import { search } from '../../../bot/search.ts';
import type { Bot, Choice, Level, Move, Searchable, Seat } from '../../../game.ts';
import type { RingPosition } from '../rules.ts';
import { Board, FIVE, FOUR, WIN } from './board.ts';
import opening from './opening.gen.ts';
import { threat } from './threats.ts';

// The board with its root moves replaced: the search's root list holds step 4's defences.
function rooted(b: Board, root: readonly Move[]): Searchable {
  let ply = 0;
  return {
    turn: () => b.turn(),
    moves: () => (ply ? b.moves() : root),
    play: (m) => {
      ply++;
      b.play(m);
    },
    undo: () => {
      ply--;
      b.undo();
    },
  };
}

// The square's eight symmetries as [a, b, c, d]: (x, y) → (a x + b y, c x + d y).
const SYMMETRIES = [
  [1, 0, 0, 1],
  [-1, 0, 0, 1],
  [1, 0, 0, -1],
  [-1, 0, 0, -1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [0, 1, -1, 0],
  [0, -1, -1, 0],
];
const data = opening as Readonly<Record<string, readonly (readonly number[])[]>>;

// The opening data's moves on the second and third moves, on the board it was made for, 15 × 15 with the first stone
// on the centre: its replies under every symmetry that maps its shape onto the board's, set out from the first stone,
// kept where they fall on an empty cell.
function opened(b: Board): Move[] {
  const n = b.n;
  const stones = [...b.cells.keys()].filter((c) => b.cells[c]).sort((u, w) => b.cells[u] - b.cells[w]);
  if (n !== 15 || !stones.length || stones.length > 2 || stones[0] !== (n * n - 1) / 2) return [];
  const [first, second] = stones.map((c) => [c % n, Math.floor(c / n)]);
  const out = new Set<Move>();
  for (const [a, b2, c, d] of SYMMETRIES) {
    const map = ([x, y]: readonly number[]) => [first[0] + a * x + b2 * y, first[1] + c * x + d * y];
    const shape = second
      ? Object.keys(data).find((k) => k !== 'one' && map(k.split(',').map(Number)).join() === second.join())
      : 'one';
    for (const [col, row] of (shape ? data[shape] : []).map(map))
      if (col >= 0 && col < n && row >= 0 && row < n && !b.cells[row * n + col]) out.add((row * n + col) * 3);
  }
  return [...out];
}

function choose(p: RingPosition, row: Level, rng: () => number): Choice | undefined {
  if (!row.x) return undefined;
  const x = row.x;
  const b = Board.from(p);
  const me = b.side;
  const you = (1 - me) as Seat;
  let nodes = 0;
  const pick = (moves: readonly Move[]) => moves[Math.floor(rng() * moves.length)];
  const played = (move: Move, value?: -1 | 1): Choice => ({
    move,
    nodes,
    exact: value !== undefined,
    ...(value && { value }),
  });
  const kernel = { key: () => b.key(), evaluate: () => b.evaluate() };
  // 1. Make five: the policy's win in one has played it already. 2. Block the other seat's five, the board's moves
  // when it has one: one block is forced, and with two the game is lost.
  let root = x.raw ? b.near() : b.moves(Number.POSITIVE_INFINITY);
  if (root.length === 1) return played(root[0]);
  if (!x.raw && b.has(you, FIVE)) return played(pick(root), -1);
  const book = x.open ? opened(b) : [];
  if (book.length) return played(pick(book));
  if (x.vcf || x.vct) {
    // Each threat step gets a quarter of the row's nodes, and step 4 also what step 3 left.
    const share = Math.floor(row.nodes / 4);
    const budget = { nodes: share };
    const run = (plies: number, threes: boolean) => {
      const before = budget.nodes;
      const line = plies ? threat(b, plies, threes, budget) : undefined;
      nodes += before - budget.nodes;
      return line;
    };
    // The other seat's threat, as it would play it: 2 a VCF, or not known once the nodes ran out, 1 a VCT only, 0
    // none; and its line.
    const danger = (): [number, Move[]] => {
      const vcf = run(x.vcf ?? 0, false);
      const vct = vcf ? undefined : run(x.vct ?? 0, true);
      return vcf ? [2, vcf] : vct ? [1, vct] : [budget.nodes > 0 ? 0 : 2, []];
    };
    // A move's own play, counted against the threat budget.
    const step = (m: Move) => {
      budget.nodes--;
      nodes++;
      b.play(m);
    };
    // 3. Win by continuous fours.
    const win = run(x.vcf ?? 0, false);
    if (win) return played(win[0], 1);
    budget.nodes += share;
    // 4. Against the other seat's VCF or VCT, only the moves that break it, tried among the cells of its line, fours
    // of mine, and, when it threatens an unstoppable four, its four cells: those that leave no threat, else those
    // that leave at most a VCT. A four of mine is judged after the block it forces, with me to move again, so a four
    // that only delays the threat does not count as breaking it.
    b.flip();
    const [, line] = danger();
    b.flip();
    if (line.length) {
      const tries = new Set([...line, ...(b.has(you, WIN) ? b.moves() : b.with(me, FOUR))]);
      // What is left of the threat after a try, as danger() counts it; a play the nodes cannot pay for leaves it
      // not known (2).
      const judge = (m: Move): number => {
        if (budget.nodes <= 0) return 2;
        step(m);
        const block = b.with(me, FIVE);
        let still = 2;
        if (block.length > 1) still = 0;
        else if (!block.length) [still] = danger();
        else if (budget.nodes > 0) {
          step(block[0]);
          b.flip();
          [still] = danger();
          b.flip();
          b.undo();
        }
        b.undo();
        return still;
      };
      const left = [...tries].map((m) => [m, judge(m)] as const);
      const least = Math.min(...left.map(([, still]) => still));
      if (least < 2) root = left.filter(([, still]) => still === least).map(([m]) => m);
    }
  }
  if (root.length === 1) return played(root[0]);

  // 5. The top picks of the low levels: every root move valued, then the best or, with the row's chance, any of the
  // top few. Pip (depth 1) values a move by the pattern score it makes for itself and shuns a move that leaves the
  // other seat a five to make, blind to its threes (7.2); deeper levels by a search one ply shorter.
  if (x.top) {
    const valued: [Move, number][] = [];
    for (const [i, m] of root.entries()) {
      if (nodes >= row.nodes) break;
      nodes++;
      const gain = b.gain(m, me);
      b.play(m);
      const t = b.turn();
      let v: number;
      if (typeof t === 'object') v = t.winner === null ? 0 : Number.POSITIVE_INFINITY;
      else if (row.depth < 2) v = b.has(you, FIVE) ? Number.NEGATIVE_INFINITY : gain;
      else {
        const share = Math.floor((row.nodes - nodes) / (root.length - i));
        const r = search(b, { ...kernel, depth: row.depth - 1, nodes: share });
        nodes += r.nodes;
        v = -r.value;
      }
      b.undo();
      valued.push([m, v]);
    }
    if (!valued.length) return played(root[0]);
    valued.sort((u, w) => w[1] - u[1]);
    if (rng() < (x.wide ?? 0)) return played(pick(valued.slice(0, x.top).map(([m]) => m)));
    return played(pick(valued.filter(([, v]) => v === valued[0][1]).map(([m]) => m)));
  }
  // 5. The kernel search over the pattern board from the root list.
  const r = search(rooted(b, root), { ...kernel, depth: row.depth, nodes: row.nodes - nodes, margin: row.margin });
  nodes += r.nodes;
  return played(pick(r.best));
}

export const hooks: Bot<RingPosition> = {
  fast: (p) => Board.from(p),
  key: (s) => (s as Board).key(),
  evaluate: (s) => (s as Board).evaluate(),
  choose,
};
