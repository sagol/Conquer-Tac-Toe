// Threat-space search on the pattern board (7.3 steps 3 and 4): victory by continuous fours (VCF) and, with
// `threes`, by continuous threats (VCT), for the seat to move, within a number of plies and nodes. The attacker plays
// only fours (and open threes); the defender answers a four by its one block, and an open three or an unstoppable
// four to come by any cell where either seat makes a four, which holds every block and every counter-four. The
// defender making five first, or an attacker move that threatens nothing, ends the line. Nothing is kept after the
// call, so a reply stays a function of the position (7.3).
import type { Move, Seat } from '../../../game.ts';
import { type Board, FIVE, FOUR, THREE, WIN } from './board.ts';

// A winning line for the seat to move, its moves in order with the defender's replies, or undefined when none was
// found within the plies and the nodes; `budget.nodes` is spent one play at a time.
export function threat(b: Board, plies: number, threes: boolean, budget: { nodes: number }): Move[] | undefined {
  const a = b.side;
  const d = (1 - a) as Seat;
  const failed = new Map<number, number>(); // attacker positions without a win, and the plies they were searched to

  const attack = (left: number): Move[] | undefined => {
    if (b.has(a, FIVE)) return b.with(a, FIVE).slice(0, 1);
    if (left < 3) return undefined;
    if (!b.has(d, FIVE) && b.has(a, WIN)) return b.with(a, WIN).slice(0, 1);
    const k = b.key();
    if ((failed.get(k) ?? 0) >= left) return undefined;
    // The block first, when the defender threatens five; the defender's node then asks what it threatens.
    let tries = b.has(d, FIVE) ? b.with(d, FIVE).slice(0, 1) : b.with(a, FOUR);
    if (threes && !b.has(d, FIVE)) tries = [...new Set([...tries, ...b.with(a, THREE)])];
    for (const m of tries) {
      if (budget.nodes <= 0) return undefined;
      budget.nodes--;
      b.play(m);
      const line = defend(left - 1);
      b.undo();
      if (line) return [m, ...line];
    }
    failed.set(k, left);
    return undefined;
  };

  const defend = (left: number): Move[] | undefined => {
    // The board's own moves are the replies: the block of a five, else (against a threat to come) every four cell.
    const threatened = b.has(a, FIVE) || (threes && b.has(a, WIN));
    if (typeof b.turn() === 'object' || b.has(d, FIVE) || !threatened) return undefined;
    const replies = b.moves();
    if (replies.length > 1 && b.has(a, FIVE)) return replies.slice(0, 2);
    let first: Move[] | undefined;
    for (const r of replies) {
      if (budget.nodes <= 0) return undefined;
      budget.nodes--;
      b.play(r);
      const line = attack(left - 1);
      b.undo();
      if (!line) return undefined;
      first ??= [r, ...line];
    }
    return first;
  };

  return attack(plies);
}
