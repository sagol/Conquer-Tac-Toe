// engine/src/play.ts: the only way from text to moves (room, web, arena, tools).
import type { Clock, Move, Opts, Position, Seat, Variant } from './game.ts';
import { hash } from './random.ts';

export const MAX_PLIES = 1000; // reached: draw, reason 'Move limit'; each 6.n states a shorter longest game
const DAY = 86_400_000;
export const RELAXED: Clock = Object.freeze({ initialMs: DAY, incrementMs: DAY, capMs: DAY }); // one day per move (D-07)

// The m in moves() with name(m) === text.
export function find(p: Position, text: string): Move | undefined {
  return p.moves().find((m) => p.name(m) === text);
}

// Strict replay throws on a rejected name; tolerant replay (wake, replay viewer) stops there.
export function replay(
  v: Variant,
  o: Opts,
  names: readonly string[],
  tolerant = false,
): { pos: Position; movers: Seat[]; stop?: number } {
  const pos = v.start(o);
  const movers: Seat[] = [];
  for (const [i, name] of names.entries()) {
    const m = find(pos, name);
    if (m === undefined) {
      if (tolerant) return { pos, movers, stop: i };
      throw new RangeError(`move ${i + 1}, '${name}', is not legal`);
    }
    movers.push(pos.turn() as Seat);
    pos.play(m);
  }
  return { pos, movers };
}

// Keys and values from v.options, the defaults filling missing keys, then v.start for the mix.
export function checkOpts(v: Variant, raw: unknown): Opts {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new RangeError('options must be an object');
  const given = raw as Record<string, unknown>;
  const unknown = Object.keys(given).find((key) => !v.options.some((o) => o.key === key));
  if (unknown !== undefined) throw new RangeError(`unknown option ${unknown}`);
  const opts: Record<string, number> = {};
  for (const { key, values, default: fallback } of v.options) {
    const value = Object.hasOwn(given, key) ? given[key] : fallback;
    if (typeof value !== 'number' || !values.includes(value))
      throw new RangeError(`${key} must be one of ${values.join(', ')}`);
    opts[key] = value;
  }
  v.start(opts);
  return opts;
}

// A retried bot turn replays the same choice.
export function seedFor(gameId: string, ply: number): number {
  return hash(`${gameId}:${ply}`);
}
