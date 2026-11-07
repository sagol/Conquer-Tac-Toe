// engine/src/grid.ts: cell names and lines on any cols × rows board (index = row * cols + col, A1 bottom left).

// The cell's name: its column letter, then its row number from 1 (6.0).
export function cellName(cell: number, cols: number): string {
  return String.fromCharCode(65 + (cell % cols)) + (Math.floor(cell / cols) + 1);
}

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

// The cells of every run of at least `length` cells through `cell` that `owner` gives the same seat as `cell`,
// each run in sweep order and joined; empty when there is none. `owner` maps a cell to its seat, or -1.
export function lines(cols: number, rows: number, cell: number, owner: (cell: number) => number, length: number) {
  const seat = owner(cell);
  const mine = (c: number, r: number) => c >= 0 && c < cols && r >= 0 && r < rows && owner(r * cols + c) === seat;
  const found: number[] = [];
  for (const [dc, dr] of DIRECTIONS) {
    let c = cell % cols;
    let r = Math.floor(cell / cols);
    while (mine(c - dc, r - dr)) {
      c -= dc;
      r -= dr;
    }
    let n = 1;
    while (mine(c + n * dc, r + n * dr)) n++;
    if (n >= length) for (let i = 0; i < n; i++) found.push((r + i * dr) * cols + c + i * dc);
  }
  return found;
}
