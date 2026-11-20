// The Worker (plan 4.1): one Hono app for the Worker-first paths of wrangler.jsonc (/api/*, /ws/*, /admin), the
// GameRoom and Hub classes and the daily cron. Static assets serve every other path, index.html for unknown ones.
import { variants } from 'engine/games';
import { type Context, Hono, type Next } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { access, isAdmin } from './admin.ts';
import { devLogin, googleCallback, googleStart, logout, me, signedIn } from './auth.ts';
import * as db from './db.ts';
import { hub } from './hub.ts';
import { getSettings, putSettings, type Settings, settings } from './settings.ts';

export { Hub } from './hub.ts';
export { GameRoom } from './room.ts';

export type App = { Bindings: Env; Variables: { settings: Settings; user: db.Session; sid: string; admin: string } };
export type Limit = 'AUTH_LIMIT' | 'API_LIMIT' | 'WS_IP_LIMIT' | 'WS_USER_LIMIT';

// One logger (plan 5): an event and its fields as one JSON line. Ids, route patterns, counts and reasons only; never
// emails, names, handles, tokens, cookies, IP addresses, rows or bodies (S-06).
export function log(event: string, fields: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...fields }));
}

// One error shape (plan 5): {error, message}, plus `until` for a ban (A-22).
export function fail(c: Context<App>, status: ContentfulStatusCode, error: string, message: string, extra = {}) {
  return c.json({ error, message, ...extra }, status);
}

// JSON.parse that answers undefined instead of throwing.
export function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

// Request bodies (spec 3): a JSON object of at most 4 KB, or undefined. A larger declared length is refused unread.
export async function readJson(c: Context<App>) {
  if (!/^application\/json\s*(;|$)/i.test(c.req.header('content-type') ?? '')) return;
  if (Number(c.req.header('content-length') ?? 0) > 4096) return;
  const text = await c.req.text();
  const body = new TextEncoder().encode(text).length <= 4096 ? parse(text) : undefined;
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
}

// Soft rate limits (4.5): a refusal is 429 with Retry-After and a log line naming the limit, never the key.
export async function limited(c: Context<App>, name: Limit, key: string) {
  if ((await c.env[name].limit({ key })).success) return;
  log('rate', { limit: name });
  c.header('Retry-After', '60');
  return fail(c, 429, 'rate', 'Too many requests');
}

const ipLimit = (name: Limit) => async (c: Context<App>, next: Next) =>
  (await limited(c, name, c.req.header('cf-connecting-ip') ?? 'local')) ?? next();

// Settings, then maintenance (spec 10, S-14): an admin is known from Access before any session, so the bypass works.
async function gate(c: Context<App>, next: Next) {
  c.set('settings', await settings(c.env.DB));
  if (c.get('settings').maintenance && !(await isAdmin(c))) return fail(c, 503, 'maintenance', 'Down for maintenance');
  return next();
}

const app = new Hono<App>();

app.use(async (c, next) => {
  await next();
  if (c.res.status !== 101) c.header('Cache-Control', 'no-store');
});

// Origin rule (task 4, D-16): any method but GET, any body and every upgrade needs Origin equal to this origin (A-31,
// A-32; HEAD counts as non-GET).
const isUpgrade = (c: Context<App>) => c.req.header('upgrade')?.toLowerCase() === 'websocket';
app.use(async (c, next) => {
  const body = Number(c.req.header('content-length')) > 0 || c.req.header('transfer-encoding') !== undefined;
  const needs = c.req.method !== 'GET' || body || isUpgrade(c);
  const same = c.req.header('origin') === new URL(c.req.url).origin;
  return !needs || same ? next() : fail(c, 403, 'forbidden', 'Cross-origin request');
});

// Liveness: no settings and no session, so maintenance never blocks it (A-8); the count proves the registry loads.
app.get('/api/health', async (c) => {
  const up = await db.ping(c.env.DB).catch(() => null);
  return up ? c.json({ ok: true, variants: variants.length }) : fail(c, 503, 'unavailable', 'Database unavailable');
});

// Admin paths: Access first, registered before any admin route; no maintenance gate and no rate limit (A-18, A-26).
app.use('/api/admin/*', access);
app.get('/api/admin/settings', getSettings);
app.put('/api/admin/settings', putSettings);
app.on('GET', ['/admin', '/admin/*'], access, (c) => c.env.ASSETS.fetch(c.req.raw));

// The API (spec 3.1): Origin (above), the IP limit on sign-in routes, the gate, then session, ban and user limit.
app.use('/api/auth/*', ipLimit('AUTH_LIMIT'));
app.use('/api/*', gate);
app.get('/api/auth/google', googleStart);
app.get('/api/auth/google/callback', googleCallback);
app.post('/api/auth/dev', devLogin);
app.post('/api/auth/logout', signedIn('API_LIMIT', false), logout);
app.get('/api/me', signedIn('API_LIMIT'), (c) => c.json(me(c.get('user'))));

// Upgrades (spec 2.3): 426 without one, Origin (above), the IP limit, the gate, session, ban and user limit. The
// object gets the user and session expiry in headers that replace any client value; it has no public route.
const upgradeOnly = (c: Context<App>, next: Next) =>
  isUpgrade(c) ? next() : fail(c, 426, 'upgrade_required', 'Expected a WebSocket upgrade');
app.on('GET', ['/ws/hub', '/ws/game/:id'], upgradeOnly, ipLimit('WS_IP_LIMIT'), gate, signedIn('WS_USER_LIMIT'));
function forward(c: Context<App>, stub: DurableObjectStub) {
  const headers = new Headers(c.req.raw.headers);
  headers.set('x-conquer-uid', String(c.get('user').id));
  headers.set('x-conquer-exp', String(c.get('user').expires_at));
  return stub.fetch(new Request(c.req.raw, { headers }));
}
app.get('/ws/hub', (c) => forward(c, hub(c.env)));
app.get('/ws/game/:id', (c) => {
  let id: DurableObjectId;
  try {
    id = c.env.ROOMS.idFromString(c.req.param('id')); // a malformed id or another namespace's throws (P:120)
  } catch {
    return c.notFound();
  }
  return forward(c, c.env.ROOMS.get(id));
});

app.notFound((c) => fail(c, 404, 'not_found', 'Not found'));

// One error handler (task 8, ASVS 7.4.1): the route pattern, never the URL, and a generic 500 with the ray id.
const errorFields = (err: Error) => ({ name: err.name, message: String(err.message).slice(0, 200) });
app.onError((err, c) => {
  const ray = c.req.header('cf-ray') ?? 'local';
  log('error', { route: c.req.routePath, method: c.req.method, ray, ...errorFields(err) });
  return fail(c, 500, 'internal', `Internal error (ref ${ray})`);
});

// The daily cron (task 8), a list of steps: M11 adds the D-25 resumption (A-2). A failure is logged and rethrown so
// the invocation shows as failed.
const steps = [async (env: Env) => log('cron_sessions', { deleted: await db.expireSessions(env.DB, Date.now()) })];
async function scheduled(_: ScheduledController, env: Env) {
  for (const step of steps) {
    await step(env).catch((err) => {
      log('error', { route: 'cron', ...errorFields(err) });
      throw err;
    });
  }
}

export default { fetch: app.fetch, scheduled } satisfies ExportedHandler<Env>;
