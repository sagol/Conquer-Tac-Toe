// The rings family's rules (6.1): one position class for every variant, set up by its entry in index.ts.
import type { Move, Outcome, Piece, Position, Seat, TrayItem, View } from '../../game.ts';
import { cellName, lines } from '../../grid.ts';

export interface RingSetup {
  size: number; // the board is size × size
  line: number; // a line of this many or more of the mover's top rings wins
  win: string; // the reason when it does
  piece: Piece['kind'];
  stock?: readonly [number, number, number]; // rings per seat by size S, M, L; absent = unlimited, one size
  cover?: 'smaller' | 'same'; // a ring may cover a smaller ring, or one no larger, of either colour
  hint: string;
}

const SIZES = 'SML';
const NO_MOVES = 'No moves left';

// A move is cell * 3 + size; a cell holds 0 when empty, else 1 + seat * 3 + size of its top ring.
export class RingPosition implements Position {
  private readonly setup: RingSetup;
  private readonly cells: Uint8Array;
  private readonly stock = new Int8Array(6); // rings left, seat * 3 + size; unused when the stock is unlimited
  private readonly history: number[] = []; // per play: cell << 8 | the cell's old value << 3 | size << 1 | mover
  private side: Seat = 0;
  private end: Outcome | undefined;
  private readonly owner = (cell: number) => (this.cells[cell] ? Math.floor((this.cells[cell] - 1) / 3) : -1);

  constructor(setup: RingSetup) {
    this.setup = setup;
    this.cells = new Uint8Array(setup.size * setup.size);
    this.stock.set([...(setup.stock ?? []), ...(setup.stock ?? [])]);
  }

  turn(): Seat | Outcome {
    return this.end ?? this.side;
  }

  moves(): readonly Move[] {
    const out: Move[] = [];
    if (this.end) return out;
    for (let size = this.setup.stock ? 2 : 0; size >= 0; size--) {
      if (this.setup.stock && !this.stock[this.side * 3 + size]) continue;
      for (let cell = 0; cell < this.cells.length; cell++) if (this.fits(cell, size)) out.push(cell * 3 + size);
    }
    return out;
  }

  play(m: Move): void {
    const cell = Math.floor(m / 3);
    const size = m % 3;
    const seat = this.side;
    this.history.push((cell << 8) | (this.cells[cell] << 3) | (size << 1) | seat);
    this.cells[cell] = 1 + seat * 3 + size;
    if (this.setup.stock) this.stock[seat * 3 + size]--;
    // Only the mover's rings changed, and only on this cell, so a line can only be the mover's, through it.
    const line = lines(this.setup.size, this.setup.size, cell, this.owner, this.setup.line);
    const next: Seat = seat ? 0 : 1;
    if (line.length) this.end = { winner: seat, reason: this.setup.win, line };
    else if (this.canMove(next)) this.side = next;
    else if (!this.canMove(seat)) this.end = { winner: null, reason: NO_MOVES };
  }

  undo(): void {
    const h = this.history.pop();
    if (h === undefined) return; // nothing played, nothing to restore
    const cell = h >> 8;
    this.cells[cell] = (h >> 3) & 7;
    if (this.setup.stock) this.stock[(h & 1) * 3 + ((h >> 1) & 3)]++;
    this.side = (h & 1) as Seat;
    this.end = undefined;
  }

  name(m: Move): string {
    return cellName(Math.floor(m / 3), this.setup.size) + (this.setup.stock ? SIZES[m % 3] : '');
  }

  label(m: Move): string {
    return this.path(m).join(' → ');
  }

  path(m: Move): readonly string[] {
    const cell = cellName(Math.floor(m / 3), this.setup.size);
    return this.setup.stock ? [SIZES[m % 3], cell] : [cell];
  }

  view(): View {
    const { size, stock, hint } = this.setup;
    const cells = Array.from(this.cells, (v) => (v ? this.piece(Math.floor((v - 1) / 3) as Seat, (v - 1) % 3) : null));
    return { cols: size, rows: size, cells, hint, ...(stock && { tray: [this.tray(0), this.tray(1)] }) };
  }

  private piece(seat: Seat, size: number): Piece {
    return { seat, kind: this.setup.piece, ...(this.setup.stock && { size: size as 0 | 1 | 2 }) };
  }

  private tray(seat: Seat): TrayItem[] {
    return [0, 1, 2].map((size) => ({
      piece: this.piece(seat, size),
      left: this.stock[seat * 3 + size],
      target: SIZES[size],
    }));
  }

  private fits(cell: number, size: number): boolean {
    const top = this.cells[cell];
    if (!top) return true;
    const below = (top - 1) % 3;
    return this.setup.cover === 'same' ? below <= size : this.setup.cover === 'smaller' && below < size;
  }

  // A larger ring fits wherever a smaller one does, so the seat can move when its largest ring fits somewhere.
  private canMove(seat: Seat): boolean {
    let size = this.setup.stock ? 2 : 0;
    while (size >= 0 && this.setup.stock && !this.stock[seat * 3 + size]) size--;
    for (let cell = 0; size >= 0 && cell < this.cells.length; cell++) if (this.fits(cell, size)) return true;
    return false;
  }
}
