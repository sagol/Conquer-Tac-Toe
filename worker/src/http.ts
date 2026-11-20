// Request helpers shared by the Worker's modules. index.ts is imported for its types only, so no runtime import
// points back at it.
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { App, Limit } from './index.ts';

// One logger (plan 5): an event and its fields as one JSON line. Ids, route patterns, counts and reasons only; never
// emails, names, handles, tokens, cookies, IP addresses, rows or bodies (S-06).
export const log = (event: string, fields: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ event, ...fields }));

// One error shape (plan 5): {error, message}, plus `until` for a ban (A-22).
export const fail = (c: Context, status: ContentfulStatusCode, error: string, message: string, extra = {}) =>
  c.json({ error, message, ...extra }, status);

// JSON.parse that answers undefined instead of throwing.
export function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Request bodies (spec 3): a JSON object, or undefined. The 4 KB cap is the route's bodyLimit (index.ts, json).
export async function readJson(c: Context<App>) {
  if (!/^application\/json\s*(;|$)/i.test(c.req.header('content-type') ?? '')) return;
  const body = parse(await c.req.text());
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
}

// Soft rate limits (4.5): a refusal is 429 with Retry-After and a log line naming the limit, never the key.
export async function limited(c: Context<App>, name: Limit, key: string) {
  if ((await c.env[name].limit({ key })).success) return;
  log('rate', { limit: name });
  c.header('Retry-After', '60');
  return fail(c, 429, 'rate', 'Too many requests');
}
