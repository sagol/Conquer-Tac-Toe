// budget: 350 lines, 200 KB
// The rings family: the five launch arenas of 6.1, hidden until M4 (D-21).
import type { Clock, Five, Level, Opts, Variant } from '../../game.ts';
import { RingPosition, type RingSetup } from './rules.ts';

// Placeholder rows: M2 sets the five levels of 7.2, and K1's level clause checks them from then on.
const row: Level = { rating: 0, tip: '', ms: 0, depth: 0, nodes: 0, noise: 0 };
const levels: Five<Level> = [row, row, row, row, row];
const quick: Clock = { initialMs: 180_000, incrementMs: 2_000, capMs: 180_000 }; // 3+2
const three = { size: 3, line: 3, win: 'Three in a row' } as const;
const sized = { piece: 'ring', cover: 'smaller', hint: 'Drop a ring or cover a smaller one' } as const;
const covers = 'A covered ring leaves the game for good.';
const coverSmaller = {
  text: `Drop a ring from your stock on an empty cell, or on a smaller ring of either colour. ${covers}`,
  moves: 'B2M B2L',
};
const lineOf3 = {
  text: 'Three of your rings on top in a row, a column or a diagonal win.',
  moves: 'A1S B2S A2S C3S A3S',
};
const passes = { text: 'A player with no legal move passes. When neither player can move, the game is a draw.' };
const upTo5 = [0, 1, 2, 3, 4, 5];

// Every entry is hidden with placeholder levels until M2 and M4, and gets its bot hooks in M2.
type Entry = Omit<Variant<RingPosition>, 'levels' | 'status' | 'start' | 'bot'> & { setup(o: Opts): RingSetup };
const ring = ({ setup, ...entry }: Entry): Variant<RingPosition> => ({
  ...entry,
  levels,
  status: 'hidden',
  // Values off the option list (a raw caller, an old stored row) throw like a bad mix instead of building a board.
  start: (o) => {
    if (entry.options.some(({ key, values }) => !values.includes(o[key])))
      throw new RangeError(`options off the list: ${JSON.stringify(o)}`);
    return new RingPosition(setup(o));
  },
  bot: async () => ({}),
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
    ceiling: () => 'exact',
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
    ceiling: () => 'search',
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
    ceiling: () => 'exact',
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
    ceiling: () => 'exact',
    setup: () => ({ ...three, ...sized, cover: 'same', hint: 'Drop a ring or cover one no larger', stock: [3, 3, 2] }),
  }),
  ring({
    id: 'custom',
    title: 'Custom',
    line: 'Pick the ring stock',
    tone: 'x',
    rules: [
      { text: 'The creator picks 0 to 5 rings of each size, at least 3 in all, and both players get that stock.' },
      coverSmaller,
      lineOf3,
      passes,
    ],
    options: [
      { key: 's', label: 'Small rings', values: upTo5, default: 3 },
      { key: 'm', label: 'Medium rings', values: upTo5, default: 3 },
      { key: 'l', label: 'Large rings', values: upTo5, default: 2 },
    ],
    clock: quick,
    preview: 'A1S B2M B2L C3S',
    // Exact on the default stock until M2 lists the exact set (7.3), search elsewhere.
    ceiling: (o) => (o.s === 3 && o.m === 3 && o.l === 2 ? 'exact' : 'search'),
    setup: (o) => {
      const total = o.s + o.m + o.l;
      if (total < 3 || total > 15) throw new RangeError(`Custom takes 3 to 15 rings in all, not ${total}`);
      return { ...three, ...sized, stock: [o.s, o.m, o.l] };
    },
  }),
];
