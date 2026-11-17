// The pattern board (7.3): Gomoku's fast copy for search, the threat searches and the trap-free policy steps. It
// keeps, for every cell and direction, the eight cells around it as a 16-bit line code, updated only around the
// last move, and from those codes each empty cell's pattern for both seats, its score and the evaluation sums.
import type { Move, Outcome, Searchable, Seat } from '../../../game.ts';
import { DIRECTIONS, lines } from '../../../grid.ts';
import { random } from '../../../random.ts';
import type { RingPosition } from '../rules.ts';

// What a stone of the seat on the empty centre cell makes along one line, from best to worst: five or more (F5), a
// four with two five points (F4) or one (B4), a three that one more stone turns into F4 (F3) or only B4 (B3), and
// the twos below them.
const F5 = 7;
const F4 = 6;
const B4 = 5;
const F3 = 4;

// A line code holds the cells at offsets -4..-1 and 1..4 from the centre, two bits each (slot j at bits 2j):
// 0 empty, 1 a stone of the seat the code is read for, 2 the other seat's stone, 3 off the board.
const OFFSETS = [-4, -3, -2, -1, 1, 2, 3, 4];
const PATTERNS = new Int8Array(1 << 16).fill(-1); // filled on first use
function pattern(code: number): number {
  const known = PATTERNS[code];
  if (known >= 0) return known;
  const mine = (j: number) => ((code >> (2 * j)) & 3) === 1;
  let run = 1;
  for (let j = 3; j >= 0 && mine(j); j--) run++;
  for (let j = 4; j < 8 && mine(j); j++) run++;
  let fives = 0;
  let best = 0;
  if (run < 5)
    for (let j = 0; j < 8; j++) {
      if ((code >> (2 * j)) & 3) continue;
      const p = pattern(code | (1 << (2 * j)));
      if (p === F5) fives++;
      else if (p > best) best = p;
    }
  // One more stone that makes a five, twice or once, is a four; otherwise the best it makes, two steps down.
  const p = run >= 5 ? F5 : fives > 1 ? F4 : fives ? B4 : best >= 3 ? best - 2 : 0;
  PATTERNS[code] = p;
  return p;
}
// Both seats' patterns of a code, seat 0's in the low three bits: the code read for seat 1 has stones 1 and 2 traded.
const PAIRS = new Int8Array(1 << 16).fill(-1);
function pair(code: number): number {
  const known = PAIRS[code];
  if (known >= 0) return known;
  PAIRS[code] = pattern(code) | (pattern(((code & 0x5555) << 1) | ((code >> 1) & 0x5555)) << 3);
  return PAIRS[code];
}

// A cell's flags for a seat: it makes five, it makes a four that cannot be stopped (F4, or two fours), it makes a
// four, it makes an open three.
export const FIVE = 1;
export const WIN = 2;
export const FOUR = 4;
export const THREE = 8;
// Pattern weights for the move scores and the evaluation, and a bonus for two threats from one cell.
const WEIGHT = [0, 2, 5, 8, 24, 30, 120, 2000];
const DOUBLE = 200;
// A cell's worth for a seat from its four patterns (3 bits each, by direction): score << 4 | flags.
const WORTH = Int32Array.from({ length: 1 << 12 }, (_, i) => {
  let fours = 0;
  let threes = 0;
  let score = 0;
  let flags = 0;
  for (let d = 0; d < 4; d++) {
    const p = (i >> (3 * d)) & 7;
    score += WEIGHT[p];
    if (p === F5) flags |= FIVE;
    if (p === B4 || p === F4) fours++;
    if (p === F4 || fours > 1) flags |= WIN;
    if (p === F3) threes++;
  }
  if (flags & FIVE) flags &= ~WIN;
  if (fours + threes > 1) score += DOUBLE;
  return (score << 4) | flags | (fours ? FOUR : 0) | (threes ? THREE : 0);
});

// Per size, the neighbour of every cell in each direction and slot (-1 off the board), the empty board's line codes
// and the Zobrist numbers, high and low 32 bits: two per cell (seat 0, seat 1), then the side to move.
type Shape = ReturnType<typeof shape>;
const shapes = new Map<number, Shape>();
function shape(n: number) {
  const cells = n * n;
  const near = new Int16Array(cells * 32);
  const codes = new Uint16Array(cells * 4);
  for (let cell = 0; cell < cells; cell++)
    for (let d = 0; d < 4; d++)
      for (let j = 0; j < 8; j++) {
        const c = (cell % n) + DIRECTIONS[d][0] * OFFSETS[j];
        const r = Math.floor(cell / n) + DIRECTIONS[d][1] * OFFSETS[j];
        const inside = c >= 0 && c < n && r >= 0 && r < n;
        near[(cell * 4 + d) * 8 + j] = inside ? r * n + c : -1;
        if (!inside) codes[cell * 4 + d] |= 3 << (2 * j);
      }
  const rng = random(0x60_6d_6b + n);
  const zobrist = Int32Array.from({ length: cells * 4 + 2 }, () => rng() * 2 ** 32);
  return { near, codes, zobrist };
}

export class Board implements Searchable {
  readonly n: number;
  readonly cells: Uint8Array; // 0 empty, else 1 + the seat
  private readonly worth: Int32Array; // cell * 2 + seat, for empty cells: a stone of the seat there, score << 4 | flags
  private readonly sum = [0, 0]; // each seat's scores over the empty cells
  private readonly count = new Int32Array(8); // seat * 4 + flag bit: empty cells that carry the flag
  side: Seat = 0;
  private end: Outcome | undefined;
  private stones = 0;
  private high = 0;
  private low = 0;
  private readonly codes: Uint16Array;
  private readonly index: Uint16Array; // cell * 2 + seat: the cell's four patterns for the seat, its WORTH index
  private readonly around: Uint8Array; // stones within two cells, in each direction, of each cell
  private readonly shape: Shape;
  private readonly history: number[] = [];

  constructor(n: number) {
    this.n = n;
    let known = shapes.get(n);
    if (!known) {
      known = shape(n);
      shapes.set(n, known);
    }
    this.shape = known;
    this.cells = new Uint8Array(n * n);
    this.worth = new Int32Array(n * n * 2);
    this.index = new Uint16Array(n * n * 2);
    this.around = new Uint8Array(n * n);
    this.codes = this.shape.codes.slice();
    for (let cell = 0; cell < n * n; cell++) this.refresh(cell);
  }

  // The fast copy of a Gomoku position: its stones, the seat to move and its result.
  static from(p: RingPosition): Board {
    const b = new Board(Math.sqrt(p.cells.length));
    for (const [cell, v] of p.cells.entries()) if (v) b.put(cell, v === 1 ? 0 : 1);
    if (b.stones % 2) b.flip(); // no seat ever passes, so the stones fix the seat to move, ended or not
    const t = p.turn();
    if (typeof t === 'object') b.end = t;
    return b;
  }

  turn(): Seat | Outcome {
    return this.end ?? this.side;
  }

  // The moves the search tries, a subset of the legal ones that keeps every win in one: the fives when there are
  // any; else the blocks of the other seat's fives; else, when the other seat threatens a four it cannot be stopped
  // from, the cells where either seat makes a four (blocks and counter-fours); else the empty cells within two of a
  // stone, best first, at most `width` of them, and the centre on an empty board.
  moves(width = 16): Move[] {
    if (this.end) return [];
    const me = this.side;
    const you = (1 - me) as Seat;
    if (this.has(me, FIVE)) return this.with(me, FIVE);
    if (this.has(you, FIVE)) return this.with(you, FIVE);
    if (this.has(you, WIN)) {
      const out = this.with(me, FOUR);
      for (let cell = 0; cell < this.cells.length; cell++)
        if (this.worth[cell * 2 + you] & ~this.worth[cell * 2 + me] & FOUR) out.push(cell * 3);
      return out;
    }
    return this.near(width);
  }

  // The empty cells within two of a stone along a line, best first, at most `width` of them; the centre on an
  // empty board.
  near(width: number): Move[] {
    const half = (this.n - 1) >> 1;
    if (!this.stones) return [(half * this.n + half) * 3];
    const me = this.side;
    const out: number[] = [];
    const value: number[] = [];
    for (let cell = 0; cell < this.cells.length; cell++) {
      if (this.cells[cell] || !this.around[cell]) continue;
      const v = (this.worth[cell * 2] >> 4) + (this.worth[cell * 2 + 1] >> 4) + (this.worth[cell * 2 + me] >> 4);
      let i = out.length;
      if (i === width) {
        if (value[i - 1] >= v) continue; // the list is full and the cell ranks below all of it
        i--;
      }
      for (; i > 0 && value[i - 1] < v; i--) {
        out[i] = out[i - 1];
        value[i] = value[i - 1];
      }
      out[i] = cell * 3;
      value[i] = v;
    }
    return out;
  }

  has(seat: Seat, flag: number): boolean {
    return this.count[seat * 4 + 31 - Math.clz32(flag)] > 0;
  }

  // The moves to the empty cells that carry the flag (one flag bit) for the seat; the scan stops at the last one.
  with(seat: Seat, flag: number): Move[] {
    const out: Move[] = [];
    let left = this.count[seat * 4 + 31 - Math.clz32(flag)];
    for (let cell = 0; left && cell < this.cells.length; cell++)
      if (this.worth[cell * 2 + seat] & flag) {
        out.push(cell * 3);
        left--;
      }
    return out;
  }

  play(m: Move): void {
    const cell = m / 3;
    const seat = this.side;
    const five = this.worth[cell * 2 + seat] & FIVE;
    this.history.push(cell);
    this.put(cell, seat);
    this.flip();
    if (five) {
      const owner = (c: number) => this.cells[c] - 1;
      this.end = { winner: seat, reason: 'Five in a row', line: lines(this.n, this.n, cell, owner, 5) };
    } else if (this.stones === this.cells.length) this.end = { winner: null, reason: 'No moves left' };
  }

  undo(): void {
    const cell = this.history.pop();
    if (cell === undefined) return;
    const seat = (this.cells[cell] - 1) as Seat;
    this.flip();
    this.end = undefined;
    this.put(cell, seat, true);
  }

  // The other seat to move with no stone played: the threat searches ask what that seat could force.
  flip(): void {
    this.side = (1 - this.side) as Seat;
    this.high ^= this.shape.zobrist[this.cells.length * 4];
    this.low ^= this.shape.zobrist[this.cells.length * 4 + 1];
  }

  // Zobrist over the stones and the seat to move, mixed with the size (7.3); below 2^53.
  key(): number {
    return (this.high & 0x1fffff) * 2 ** 32 + ((this.low ^ this.n) >>> 0);
  }

  // For the seat to move, in (-1, 1): a five to make wins, two fives to block lose, an unstoppable four to make with
  // no five to block wins; otherwise the difference of the two seats' score sums, the mover's counted a little more.
  evaluate(): number {
    const me = this.side;
    const you = (1 - me) as Seat;
    if (this.has(me, FIVE)) return 0.99;
    if (this.count[you * 4] > 1) return -0.99;
    if (!this.has(you, FIVE) && this.has(me, WIN)) return 0.9;
    const x = (this.sum[me] * 1.2 - this.sum[you]) / 400;
    return (0.8 * x) / (1 + Math.abs(x));
  }

  // Places a stone of the seat on the cell, or with `lift` takes it off, and updates the line codes and worths of
  // the empty cells around it and of the cell itself, the cells within two, the key and the stone count.
  private put(cell: number, seat: Seat, lift = false): void {
    if (!lift) for (let s = 0; s < 2; s++) this.set(cell * 2 + s, s, 0);
    this.cells[cell] = lift ? 0 : seat + 1;
    this.stones += lift ? -1 : 1;
    this.high ^= this.shape.zobrist[(cell * 2 + seat) * 2];
    this.low ^= this.shape.zobrist[(cell * 2 + seat) * 2 + 1];
    const { near } = this.shape;
    for (let d = 0; d < 4; d++)
      for (let j = 0; j < 8; j++) {
        const other = near[(cell * 4 + d) * 8 + j];
        if (other < 0) continue;
        const slot = 2 * (7 - j); // the cell sits at the opposite slot of its neighbour
        const i = other * 4 + d;
        this.codes[i] = (this.codes[i] & ~(3 << slot)) | (lift ? 0 : (seat + 1) << slot);
        if (j > 1 && j < 6) this.around[other] += lift ? -1 : 1;
        if (!this.cells[other]) this.line(other, d);
      }
    if (lift) this.refresh(cell);
  }

  // Recomputes an empty cell's worths from its four line codes; a filled cell's index goes stale until then.
  private refresh(cell: number): void {
    for (let d = 0; d < 4; d++) this.line(cell, d);
  }

  // Takes direction d's patterns of an empty cell from its line code into both seats' index and worth.
  private line(cell: number, d: number): void {
    const p = pair(this.codes[cell * 4 + d]);
    for (let s = 0; s < 2; s++) {
      const i = cell * 2 + s;
      this.index[i] = (this.index[i] & ~(7 << (3 * d))) | (((p >> (3 * s)) & 7) << (3 * d));
      this.set(i, s, WORTH[this.index[i]]);
    }
  }

  // Sets a worth and keeps the seat's sum and flag counts in step.
  private set(i: number, seat: number, worth: number): void {
    const old = this.worth[i];
    if (old === worth) return;
    this.worth[i] = worth;
    this.sum[seat] += (worth >> 4) - (old >> 4);
    for (let bit = 0, diff = (old ^ worth) & 15; diff; bit++, diff >>= 1)
      if (diff & 1) this.count[seat * 4 + bit] += (worth >> bit) & 1 ? 1 : -1;
  }
}
