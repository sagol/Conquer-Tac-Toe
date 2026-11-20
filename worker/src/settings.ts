import type { Context } from 'hono';
import { type Row, settingRows, writeSettings } from './db.ts';
import { fail, log, parse, readJson } from './http.ts';
import type { App } from './index.ts';

// The admin settings (plan M5 task 7, AD-07): known keys with typed validators, no debug mode and no session
// timeout. A missing row means the default; a stored value its validator refuses is ignored and logged.
const DEFAULTS = { maintenance: false, registrations: true, creation: true, game_limit: 10, announcement: '' };
export type Settings = typeof DEFAULTS;
type Key = keyof Settings;

const flag = (v: unknown) => typeof v === 'boolean';
const VALID: Record<Key, (v: unknown) => boolean> = {
  maintenance: flag,
  registrations: flag, // Google sign-ups only (P:858)
  creation: flag,
  game_limit: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100, // 0: nobody opens a game
  announcement: (v) => typeof v === 'string' && [...v].length <= 280 && !/[^\P{Cc}\n]/u.test(v), // no controls but newline
};
const valid = (key: string, value: unknown) => Object.hasOwn(VALID, key) && VALID[key as Key](value);

// Cached per isolate for 15 s (P:863), resolved values only: a pending read is never shared, so a cancelled request
// cannot stall the others. A write caches the rows its own batch reads back (spec 9).
let cache = { at: -Infinity, values: DEFAULTS };

export async function settings(db: D1Database): Promise<Settings> {
  if (Date.now() - cache.at >= 15_000) cache = { at: Date.now(), values: from(await settingRows(db)) };
  return cache.values;
}

function from(read?: D1Result<Row>) {
  const values: Record<string, unknown> = { ...DEFAULTS };
  for (const { key, value } of read?.results ?? []) {
    const v = parse(value);
    if (valid(key, v)) values[key] = v;
    else log('settings_invalid', { key });
  }
  return values as Settings;
}

export const getSettings = async (c: Context<App>) => c.json(await settings(c.env.DB));

// A partial map: every key known and every value valid, or nothing is written (5.1.2, 5.1.3). The answer is the map
// the write's batch read back, so it never reports a stale value and needs no second read.
export async function putSettings(c: Context<App>) {
  const body = await readJson(c);
  if (!body) return fail(c, 400, 'bad_request', 'Expected a JSON object');
  const bad = Object.entries(body).find(([key, value]) => !valid(key, value));
  if (bad) return fail(c, 400, 'bad_request', `Bad setting: ${bad[0].slice(0, 40)}`);
  cache = { at: Date.now(), values: from((await writeSettings(c.env.DB, body, c.get('admin'), Date.now())).at(-1)) };
  log('settings', { keys: Object.keys(body) });
  return c.json(cache.values);
}
