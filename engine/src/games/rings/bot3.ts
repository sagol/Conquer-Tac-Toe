// The bot hooks of the 3×3 rings variants (7.3): the kernel search runs on RingPosition itself, with win/draw/loss
// scoring and an exact key; each variant's bot() adds its book.
import type { Bot, Searchable } from '../../game.ts';
import type { RingPosition } from './rules.ts';

// The eight symmetries of the square as cell maps, flattened: four quarter turns, each also mirrored.
const MAPS = Int8Array.from({ length: 72 }, (_, i) => {
  let [r, c] = [Math.floor((i % 9) / 3), i % 3];
  for (let turn = 0; turn < Math.floor(i / 9) % 4; turn++) [r, c] = [c, 2 - r];
  return r * 3 + (i < 36 ? c : 2 - c);
});

// The cells in base 7, least over the symmetries, then the six stock counts in base 6 and the seat to move (0 once
// the game is over, when cells and stocks alone fix the result): below 2^42, and equal only for equal or mirrored
// positions.
function key(s: Searchable): number {
  const p = s as RingPosition;
  let cells = Infinity;
  for (let i = 0; i < 72; i += 9) {
    let x = 0;
    for (let j = i; j < i + 9; j++) x = x * 7 + p.cells[MAPS[j]];
    if (x < cells) cells = x;
  }
  let stock = 0;
  for (const n of p.stock) stock = stock * 6 + n;
  const t = p.turn();
  return (cells * 46656 + stock) * 2 + (typeof t === 'object' ? 0 : t);
}

export const hooks: Bot<RingPosition> = { key, wdl: true };
