// budget: 350 lines, 200 KB
// The rings family: the five launch arenas of 6.1, live since M4's gates (D-21).
import type { Clock, Five, Level, Opts, Variant } from '../../game.ts';
import { RingPosition, type RingSetup } from './rules.ts';

// Objects that several entries share are frozen, so a caller that edits one entry cannot change another.
// The 3×3 levels of 7.2. checks/arena/bench sets each row's nodes, or checks a row set by hand, at the variant's
// slowest option value so that the p95 move time in workerd meets ms, a cold first move included (7.3). Omega's
// target is 140 ms unless its variant raises it to fit the nodes that pass the exactness check.
const LEVELS = [
  { tip: 'Plays on a hunch and often misses a win', ms: 50, depth: 1 },
  { tip: 'Takes a win, often misses a block', ms: 50, depth: 2 },
  { tip: 'Reads four moves ahead and sometimes slips', ms: 120, depth: 4 },
  { tip: 'Sees far ahead but slips now and then', ms: 140, depth: 99 },
  { tip: 'Plays perfectly and sets traps', ms: 140, depth: 99 },
];
// A 3×3 variant's rows: each level's display rating and noise from M4's calibration (7.4), and its nodes.
const rows = (rating: Five<number>, nodes: Five<number>, noise: Five<number>, omegaMs = LEVELS[4].ms) =>
  Object.freeze(
    LEVELS.map((level, i) =>
      Object.freeze({ rating: rating[i], ...level, ...(i === 4 && { ms: omegaMs }), nodes: nodes[i], noise: noise[i] }),
    ),
  ) as Five<Level>;
// A Gomoku row from its display rating: no policy noise (its engine keeps its own top picks, 7.2).
const gomoku = (elo: number, tip: string, ms: number, depth: number, nodes: number, x: Level['x'], margin?: number) =>
  Object.freeze({ rating: elo, tip, ms, depth, nodes, noise: 0, ...(margin && { margin }), x: Object.freeze(x) });
const quick: Clock = Object.freeze({ initialMs: 180_000, incrementMs: 2_000, capMs: 180_000 }); // 3+2
const three = { size: 3, line: 3, win: 'Three in a row' } as const;
const sized = { piece: 'ring', cover: 'smaller', hint: 'Drop a ring or cover a smaller one' } as const;
const covers = 'A covered ring leaves the game for good.';
const coverSmaller = Object.freeze({
  text: `Drop a ring from your stock on an empty cell, or on a smaller ring of either colour. ${covers}`,
  moves: 'B2M B2L',
});
const lineOf3 = Object.freeze({
  text: 'Three of your rings on top in a row, a column or a diagonal win.',
  moves: 'A1S B2S A2S C3S A3S',
});
const passes = Object.freeze({ text: 'A player who cannot move passes. When neither can, the game is a draw.' });
const upTo5 = Object.freeze([0, 1, 2, 3, 4, 5]);

type Entry = Omit<Variant<RingPosition>, 'status' | 'start'> & { setup(o: Opts): RingSetup };
const ring = ({ setup, ...entry }: Entry): Variant<RingPosition> => ({
  ...entry,
  status: 'live',
  // Values off the option list (a raw caller, an old stored row) throw like a bad mix instead of building a board.
  // The check and the board read one copy, so an option cannot pass with one value and build with another.
  start: (raw) => {
    const o = { ...raw };
    if (entry.options.some(({ key, values }) => !values.includes(o[key])))
      throw new RangeError(`options off the list: ${JSON.stringify(o)}`);
    return new RingPosition(setup(o));
  },
});

export default [
  ring({
    id: 'classic',
    title: 'Classic',
    line: 'Three in a row on a 3×3 grid',
    tone: 'lime',
    rules: [
      { text: 'Take turns marking an empty cell. The first player plays X, the second O.' },
      { text: 'Three of your marks in a row, a column or a diagonal win.', moves: 'A1 B1 A2 B2 A3' },
      { text: 'A full board without a line is a draw.', moves: 'B2 A1 C1 A3 A2 C2 B3 B1 C3' },
    ],
    options: [],
    clock: quick,
    preview: 'B2 A1 C1 A3 A2',
    levels: rows(
      [800, 920, 1030, 1140, 1280],
      [38_974, 38_974, 46_769, 77_948, 109_128],
      [0.4, 0.625, 0.282, 0.219, 0],
    ),
    ceiling: () => 'exact',
    bot: async () => (await import('./bot3.ts')).hooks,
    setup: () => ({ ...three, piece: 'glyph', hint: 'Three in a row wins' }),
  }),
  ring({
    id: 'gomoku',
    title: 'Gomoku',
    line: 'Five in a row on a big board',
    tone: 'o',
    rules: [
      { text: 'Take turns placing a stone on an empty cell.' },
      {
        text: 'Five or more of your stones in a row, a column or a diagonal win.',
        moves: 'H8 J9 H9 J10 H10 J11 H11 J12 H12',
      },
      { text: 'A full board without five in a row is a draw.' },
      { text: 'The board is 15 by 15 cells, or 10, 13 or 19 when the game is created.' },
    ],
    options: [{ key: 'size', label: 'Board size', values: [10, 13, 15, 19], default: 15 }],
    clock: { initialMs: 600_000, incrementMs: 5_000, capMs: 600_000 }, // 10+5
    preview: 'H8 J9 J8 G8 K7 H9',
    // The Gomoku levels of 7.2 as M4's calibration set them, display ratings from the held-out gate fit (7.4), run by
    // its own engine with the knobs in x (gomoku/index.ts); the bench sets nodes.
    levels: Object.freeze([
      gomoku(800, 'Looks one move ahead and often drifts', 50, 1, 9_361, { raw: 1, top: 5, wide: 0.3 }),
      gomoku(910, 'Always blocks a four, otherwise plays loose', 100, 2, 18_722, { top: 5, wide: 0.5 }),
      gomoku(1020, 'Reads four moves ahead and spots quick fours', 300, 4, 56_168, { vcf: 7 }, 0.1),
      gomoku(1140, 'Reads deep and sees threats coming', 1000, 5, 163_933, { vcf: 13, vct: 5, small: 0.12 }, 0.11),
      gomoku(1560, 'Hunts forced wins and rarely lets one through', 2500, 99, 468_074, { vcf: 21, open: 1 }, 0.02),
    ]),
    ceiling: () => 'search',
    bot: async () => (await import('./gomoku/index.ts')).hooks,
    setup: (o) => ({ size: o.size, line: 5, win: 'Five in a row', piece: 'stone', hint: 'Five or more in a row wins' }),
  }),
  ring({
    id: 'conquer',
    title: 'Conquer',
    line: 'Bigger rings cover smaller ones',
    tone: 'x',
    rules: [
      { text: 'Each player has three small, three medium and three large rings.' },
      coverSmaller,
      lineOf3,
      passes,
    ],
    options: [],
    clock: quick,
    preview: 'B2M A1S A1M B2L',
    // Nova-9's nodes are set by hand so that its cold first move, with no book behind it, meets 140 ms.
    levels: rows([800, 1000, 1180, 1390, 1690], [45_159, 45_159, 90_319, 36_000, 126_446], [0.4, 0.5, 0, 0.212, 0]),
    ceiling: () => 'exact',
    bot: async () => ({ ...(await import('./bot3.ts')).hooks, book: (await import('./book-conquer.gen.ts')).default }),
    setup: () => ({ ...three, ...sized, stock: [3, 3, 3] }),
  }),
  ring({
    id: 'chaos',
    title: 'Chaos',
    line: 'Same-size captures',
    tone: 'o',
    rules: [
      { text: 'Each player has three small, three medium and two large rings.' },
      {
        text: `Drop a ring from your stock on an empty cell, or on a ring of the same size or smaller of either colour. ${covers}`,
        moves: 'B2M B2M',
      },
      lineOf3,
      passes,
    ],
    options: [],
    clock: quick,
    preview: 'B2M B2M A1S C3L',
    // Vex's nodes finish a depth-4 search in the opening, and Omega's target is raised so that it passes the
    // exactness check past its book (7.3).
    levels: rows(
      [800, 970, 1130, 1300, 1550],
      [39_631, 39_631, 28_000, 33_056, 228_767],
      [0.4, 0.594, 0.25, 0.118, 0],
      320,
    ),
    ceiling: () => 'exact',
    bot: async () => ({ ...(await import('./bot3.ts')).hooks, book: (await import('./book-chaos.gen.ts')).default }),
    setup: () => ({ ...three, ...sized, cover: 'same', hint: 'Drop a ring or cover one no larger', stock: [3, 3, 2] }),
  }),
  ring({
    id: 'custom',
    title: 'Custom',
    line: 'Pick your own small, medium and large rings',
    tone: 'x',
    rules: [
      { text: 'Both players get the same stock of small, medium and large rings, chosen when the game is made.' },
      coverSmaller,
      lineOf3,
      passes,
    ],
    // 0 to 5 rings of each size, at least 3 in all (6.1); the exactness check proves all 206 such stocks (7.3, M4), so
    // the ceiling is exact on each, and the rows, calibrated on 3/3/2, keep noise falling level by level on all.
    options: [
      { key: 's', label: 'Small rings', values: upTo5, default: 3 },
      { key: 'm', label: 'Medium rings', values: upTo5, default: 3 },
      { key: 'l', label: 'Large rings', values: upTo5, default: 2 },
    ],
    clock: quick,
    preview: 'A1S B2M B2L C3S',
    // Nova-9's nodes leave a margin for a cold first move; Omega's target is raised to 400 ms, where the 230,000 nodes
    // that pass the exactness check on every stock (7.3) fit a cold first move.
    levels: rows(
      [800, 950, 1130, 1330, 1530],
      [23_794, 23_794, 47_589, 46_000, 230_000],
      [0.4, 0.532, 0.094, 0.094, 0],
      400,
    ),
    ceiling: () => 'exact',
    bot: async () => ({ ...(await import('./bot3.ts')).hooks, book: (await import('./book-custom.gen.ts')).default }),
    setup: (o) => {
      if (o.s + o.m + o.l < 3) throw new RangeError('Custom takes at least 3 rings in all');
      return { ...three, ...sized, stock: [o.s, o.m, o.l] };
    },
  }),
];
