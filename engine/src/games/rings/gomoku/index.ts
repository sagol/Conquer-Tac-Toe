// budget: 810 lines, 200 KB
// Gomoku's own engine (7.3): the pattern board as the fast copy, its key and evaluation, and choose(), which runs the
// fixed decision order. A level's knobs sit in its row's x: `vcf` and `vct` are the plies of the threat searches (0 or
// absent: none), `top` and `wide` the chance of a random pick among the top moves, `raw` a level that takes no
// forced step and searches every cell near a stone, and `open` a level that plays the opening data.
import { search } from '../../../bot/search.ts';
import type { Bot, Choice, Level, Move, Searchable, Seat } from '../../../game.ts';
import type { RingPosition } from '../rules.ts';
import { Board, FIVE, FOUR, WIN } from './board.ts';
import opening from './opening.gen.ts';
import { threat } from './threats.ts';

const WIN_SCORE = 2000; // the kernel search's score of a win in one, which the top picks compare with

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

// The square's eight symmetries as (x, y) → (a x + b y, c x + d y).
const SYMMETRIES = [
  1, 0, 0, 1, -1, 0, 0, 1, 1, 0, 0, -1, -1, 0, 0, -1, 0, 1, 1, 0, 0, -1, 1, 0, 0, 1, -1, 0, 0, -1, -1, 0,
];
const data = opening as Readonly<Record<string, readonly (readonly number[])[]>>;

// The opening data's moves on the second and third moves: its replies under every symmetry that maps its shape onto
// the board's, set out from the first stone, kept where they fall on an empty cell.
function opened(b: Board): Move[] {
  const n = b.n;
  const stones = [...b.cells.keys()].filter((c) => b.cells[c]).sort((u, w) => b.cells[u] - b.cells[w]);
  if (!stones.length || stones.length > 2) return [];
  const [first, second] = stones.map((c) => [c % n, Math.floor(c / n)]);
  const out = new Set<Move>();
  for (let i = 0; i < SYMMETRIES.length; i += 4) {
    const [a, c, e, g] = SYMMETRIES.slice(i, i + 4);
    const map = ([x, y]: readonly number[]) => [first[0] + a * x + c * y, first[1] + e * x + g * y];
    const shape = second
      ? Object.keys(data).find((k) => k !== 'one' && map(k.split(',').map(Number)).join() === second.join())
      : 'one';
    for (const [col, row] of (shape ? data[shape] : []).map(map))
      if (col >= 0 && col < n && row >= 0 && row < n && !b.cells[row * n + col]) out.add((row * n + col) * 3);
  }
  return [...out];
}

function choose(p: RingPosition, row: Level, rng: () => number): Choice {
  const b = Board.from(p);
  const x = row.x ?? {};
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
  let root = x.raw ? b.near(Number.POSITIVE_INFINITY) : b.moves(Number.POSITIVE_INFINITY);

  if (!x.raw) {
    // 1. Make five. 2. Block the other seat's five; with two of them the game is lost.
    if (b.has(me, FIVE)) return played(pick(b.with(me, FIVE)), 1);
    const blocks = b.with(you, FIVE);
    if (blocks.length) return played(pick(blocks), blocks.length > 1 ? -1 : undefined);
  }
  const book = x.open ? opened(b) : [];
  if (book.length) return played(pick(book));
  if (x.vcf) {
    // The threat searches share half the row's nodes.
    const budget = { nodes: row.nodes >> 1 };
    const run = (plies: number, threes: boolean) => {
      const before = budget.nodes;
      const line = plies ? threat(b, plies, threes, budget) : undefined;
      nodes += before - budget.nodes;
      return line;
    };
    // The other seat's threat, as it would play it: 2 a VCF, or not known once the nodes ran out, 1 a VCT only, 0
    // none; and its line.
    const danger = (): [number, Move[]] => {
      const vcf = run(x.vcf, false);
      const vct = vcf ? undefined : run(x.vct ?? 0, true);
      return vcf ? [2, vcf] : vct ? [1, vct] : [budget.nodes > 0 ? 0 : 2, []];
    };
    // 3. Win by continuous fours.
    const win = run(x.vcf, false);
    if (win) return played(win[0], 1);
    // 4. Against the other seat's VCF or VCT, only the moves that break it, tried among the cells of its line, fours
    // of mine, and, when it threatens an unstoppable four, its four cells: those that leave no threat, else those
    // that leave at most a VCT.
    b.flip();
    const [, line] = danger();
    b.flip();
    if (line.length) {
      const tries = new Set([...line, ...b.with(me, FOUR), ...(b.has(you, WIN) ? b.with(you, FOUR) : [])]);
      const left = [...tries].map((m) => {
        b.play(m);
        nodes++;
        const [still] = danger();
        b.undo();
        return [m, still] as const;
      });
      const least = Math.min(...left.map(([, still]) => still));
      if (least < 2) root = left.filter(([, still]) => still === least).map(([m]) => m);
    }
  }
  if (root.length === 1) return played(root[0]);

  // 5. The top picks of the low levels: every root move valued by a search one ply shorter, then the best or, with
  // the row's chance, any of the top few.
  if (x.top) {
    const valued: [Move, number][] = [];
    for (const [i, m] of root.entries()) {
      if (nodes >= row.nodes) break;
      nodes++;
      b.play(m);
      const t = b.turn();
      let v: number;
      if (typeof t === 'object') v = t.winner === null ? 0 : WIN_SCORE;
      else if (row.depth < 2) v = -b.evaluate();
      else {
        const share = Math.floor((row.nodes - nodes) / (root.length - i));
        const r = search(b, { depth: row.depth - 1, nodes: share, key: () => b.key(), evaluate: () => b.evaluate() });
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
  const r = search(rooted(b, root), {
    depth: row.depth,
    nodes: row.nodes - nodes,
    key: () => b.key(),
    evaluate: () => b.evaluate(),
    margin: row.margin,
  });
  nodes += r.nodes;
  return played(pick(r.best));
}

export const hooks: Bot<RingPosition> = {
  fast: (p) => Board.from(p),
  key: (s) => (s as Board).key(),
  evaluate: (s) => (s as Board).evaluate(),
  choose,
};
