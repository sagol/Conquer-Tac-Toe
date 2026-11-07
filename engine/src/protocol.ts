// engine/src/protocol.ts: every socket message (4.4, 4.2). Incoming text passes parseRoom or parseHub first.
import type { Opts, Seat } from './game.ts';

export const MOVE = /^[A-Za-z0-9:+-]{1,12}$/; // a move name (6.0)

export type Status = 'open' | 'active' | 'done' | 'aborted' | 'cancelled';
export type Clocks = readonly [number, number]; // ms left per seat when the message left
export interface Player {
  name: string;
  rating: number;
  uid?: number; // a user
  level?: number; // a bot level, 1 to 5
}
export interface Result {
  winner: Seat | null;
  reason: string;
  deltas?: readonly [number | null, number | null]; // rating change per seat once the result is applied
}
export interface OpenRequest {
  id: string;
  variant: string;
  opts: Opts;
  by: Player;
}
export interface LiveGame {
  id: string;
  variant: string;
  seats: readonly [Player, Player];
  move: number;
  viewers: number;
}
export interface Queue {
  variant: string;
  opts: Opts;
}
const REMATCH = ['offer', 'accept', 'decline', 'cancel'] as const;
export type RematchOp = (typeof REMATCH)[number];
export interface Failure {
  t: 'error';
  error: 'illegal' | 'forbidden' | 'limit' | 'rate';
  message: string;
}

export type RoomIn =
  | { t: 'hello'; lastSeq: number }
  | { t: 'move'; seq: number; move: string }
  | { t: 'resign' }
  | { t: 'abort' }
  | { t: 'rematch'; op: RematchOp };
export type RoomOut =
  | {
      t: 'state';
      variant: string;
      opts: Opts;
      moves: readonly string[];
      seats: readonly [Player | null, Player | null];
      clocks: Clocks;
      status: Status;
      seq: number;
      result?: Result;
      rematch?: { by: Seat; until: number };
    }
  | { t: 'moved'; seq: number; move: string; clocks: Clocks; result?: Result }
  | { t: 'ended'; result: Result }
  | { t: 'rematch'; op: RematchOp; by: Seat; game?: string } // game: the new id on accept
  | { t: 'viewers'; n: number }
  | Failure;
export type HubIn = { t: 'hello'; queue?: Queue } | ({ t: 'queue' } & Queue) | { t: 'unqueue' };
export type HubOut =
  | {
      t: 'lobby';
      requests: readonly OpenRequest[];
      games: readonly LiveGame[];
      online: number;
      top: readonly Player[];
      playing: Readonly<Record<string, number>>; // N playing per variant id
    }
  | {
      t: 'lobbyDelta';
      put: readonly (OpenRequest | LiveGame)[];
      drop: readonly string[];
      online?: number;
      playing?: Readonly<Record<string, number>>;
    }
  | { t: 'notification'; id: number; kind: string; data: string; at: number }
  | { t: 'presence'; online: number; top: readonly Player[] }
  | { t: 'matched'; id: string }
  | Failure;

// The validator: per message type, a check for each field; a field name ending in ? is optional, and no other
// field may appear.
type Fields = Readonly<Record<string, (x: unknown) => boolean>>;
const object = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const count = (x: unknown) => Number.isSafeInteger(x) && (x as number) >= 0;
const queue: Fields = {
  variant: (x) => typeof x === 'string' && /^[a-z0-9]{2,16}$/.test(x),
  opts: (x) => object(x) && Object.values(x).every((n) => Number.isFinite(n)),
};
const ROOM: Readonly<Record<string, Fields>> = {
  hello: { lastSeq: count },
  move: { seq: count, move: (x) => typeof x === 'string' && MOVE.test(x) },
  resign: {},
  abort: {},
  rematch: { op: (x) => REMATCH.includes(x as RematchOp) },
};
const HUB: Readonly<Record<string, Fields>> = { hello: { 'queue?': (x) => fits(x, queue) }, queue, unqueue: {} };

function fits(x: unknown, fields: Fields): boolean {
  if (!object(x)) return false;
  for (const key of Object.keys(x)) if (!Object.hasOwn(fields, key) && !Object.hasOwn(fields, `${key}?`)) return false;
  return Object.entries(fields).every(([key, ok]) =>
    key.endsWith('?')
      ? x[key.slice(0, -1)] === undefined || ok(x[key.slice(0, -1)])
      : Object.hasOwn(x, key) && ok(x[key]),
  );
}

function parse<T>(text: string, types: Readonly<Record<string, Fields>>): T | undefined {
  let x: unknown;
  try {
    x = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!object(x) || typeof x.t !== 'string' || !Object.hasOwn(types, x.t)) return undefined;
  return fits(x, { ...types[x.t], t: () => true }) ? (x as T) : undefined;
}

export const parseRoom = (text: string) => parse<RoomIn>(text, ROOM);
export const parseHub = (text: string) => parse<HubIn>(text, HUB);
