// budget: 350 lines, 200 KB
// The rings family: the five launch arenas of 6.1, hidden until M4 (D-21).
import type { Clock, Five, Level, Opts, Variant } from '../../game.ts';
import { RingPosition, type RingSetup } from './rules.ts';

// Objects that several entries share are frozen, so a caller that edits one entry cannot change another.
// Gomoku's levels and bot come with its engine in M3; until then it has placeholder rows and no hooks.
const row: Level = Object.freeze({ rating: 0, tip: '', ms: 0, depth: 0, nodes: 0, noise: 0 });
const placeholder: Five<Level> = Object.freeze([row, row, row, row, row]);
// The 3×3 levels of 7.2, with each variant's nodes from checks/arena/bench, which sets them at the variant's slowest
// option value so that the p95 move time in workerd meets ms. Ratings and tips are starting values that M4 tunes.
// Omega's target is 140 ms unless its variant raises it to pass the exactness check (7.3).
const LEVELS = [
  { rating: 800, tip: 'Plays on a hunch and often misses a win', ms: 50, depth: 1, noise: 0.4 },
  { rating: 1100, tip: 'Takes a win, blocks a loss, otherwise guesses', ms: 50, depth: 2, noise: 0 },
  { rating: 1400, tip: 'Reads four moves ahead', ms: 60, depth: 4, noise: 0.05 },
  { rating: 1700, tip: 'Plays perfectly, with the odd slip', ms: 100, depth: 99, noise: 0.02 },
  { rating: 2000, tip: 'Plays perfectly and sets traps', ms: 140, depth: 99, noise: 0 },
];
const rows = (nodes: Five<number>, omegaMs = 140) =>
  Object.freeze(
    LEVELS.map((level, i) => Object.freeze({ ...level, ...(i === 4 && { ms: omegaMs }), nodes: nodes[i] })),
  ) as unknown as Five<Level>;
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
// Custom's stock options: only its default stock, which M2 proves, until M4 checks the other 205 (7.3) and widens
// these lists to the stocks that pass, with the 3-ring minimum that start() then checks.
const stock = [
  { key: 's', label: 'Small rings', values: Object.freeze([3]), default: 3 },
  { key: 'm', label: 'Medium rings', values: Object.freeze([3]), default: 3 },
  { key: 'l', label: 'Large rings', values: Object.freeze([2]), default: 2 },
];

// Every entry is hidden until M4.
type Entry = Omit<Variant<RingPosition>, 'status' | 'start'> & { setup(o: Opts): RingSetup };
const ring = ({ setup, ...entry }: Entry): Variant<RingPosition> => ({
  ...entry,
  status: 'hidden',
  // Values off the option list (a raw caller, an old stored row) throw like a bad mix instead of building a board.
  start: (o) => {
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
    levels: rows([38_974, 38_974, 46_769, 77_948, 109_128]),
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
    levels: placeholder,
    ceiling: () => 'search',
    bot: async () => ({}),
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
    levels: rows([39_547, 39_547, 47_457, 79_095, 110_733]),
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
    // Omega proves the positions past its 10-ply book from about 300,000 nodes, so its target is 500 ms (7.3).
    levels: rows([49_067, 49_067, 58_881, 98_135, 490_678], 500),
    ceiling: () => 'exact',
    bot: async () => ({ ...(await import('./bot3.ts')).hooks, book: (await import('./book-chaos.gen.ts')).default }),
    setup: () => ({ ...three, ...sized, cover: 'same', hint: 'Drop a ring or cover one no larger', stock: [3, 3, 2] }),
  }),
  ring({
    id: 'custom',
    title: 'Custom',
    line: 'Pick the ring stock',
    tone: 'x',
    rules: [{ text: 'Each player has three small, three medium and two large rings.' }, coverSmaller, lineOf3, passes],
    options: stock,
    clock: quick,
    preview: 'A1S B2M B2L C3S',
    levels: rows([34_954, 34_954, 41_945, 69_908, 97_871]),
    ceiling: () => 'exact', // every stock it offers passes the exactness check (7.3)
    bot: async () => ({ ...(await import('./bot3.ts')).hooks, book: (await import('./book-custom.gen.ts')).default }),
    setup: (o) => ({ ...three, ...sized, stock: [o.s, o.m, o.l] }),
  }),
];
