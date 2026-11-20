import type { Context } from 'hono';
import { settingRows, writeSettings } from './db.ts';
import { type App, fail, log, parse, readJson } from './index.ts';

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

// Cached per isolate for 15 s (P:863); a write refreshes the writing isolate's copy at once.
let cache = { at: -Infinity, values: DEFAULTS };

export async function settings(db: D1Database): Promise<Settings> {
  if (Date.now() - cache.at < 15_000) return cache.values;
  const values: Record<string, unknown> = { ...DEFAULTS };
  for (const { key, value } of await settingRows(db)) {
    const v = parse(value);
    if (valid(key, v)) values[key] = v;
    else log('settings_invalid', { key });
  }
  cache = { at: Date.now(), values: values as Settings };
  return cache.values;
}

export const getSettings = async (c: Context<App>) => c.json(await settings(c.env.DB));

// A partial map: every key known and every value valid, or nothing is written (5.1.2, 5.1.3).
export async function putSettings(c: Context<App>) {
  const body = await readJson(c);
  if (!body) return fail(c, 400, 'bad_request', 'Expected a JSON object');
  const bad = Object.entries(body).find(([key, value]) => !valid(key, value));
  if (bad) return fail(c, 400, 'bad_request', `Bad setting: ${bad[0].slice(0, 40)}`);
  await writeSettings(c.env.DB, body, c.get('admin'), Date.now());
  cache.at = -Infinity;
  log('settings', { keys: Object.keys(body) });
  return getSettings(c);
}
