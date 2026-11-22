// The Worker (plan 4.1): one Hono app for the Worker-first paths of wrangler.jsonc (/api, /ws, /admin and below), the
// GameRoom and Hub classes and the daily cron. Static assets serve every other path, index.html for unknown ones.
import { variants } from 'engine/games';
import { type Context, Hono, type Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { except } from 'hono/combine';
import { matchedRoutes, routePath } from 'hono/route';
import { access, isAdmin } from './admin.ts';
import { devLogin, devOnly, googleCallback, googleStart, logout, me, notBanned, session } from './auth.ts';
import * as db from './db.ts';
import { fail, limit, log } from './http.ts';
import { getSettings, putSettings, settings } from './settings.ts';

export { Hub } from './hub.ts';
export { GameRoom } from './room.ts';

export type App = { Bindings: Env; Variables: { user: db.Session; admin: string } };
export type Limit = 'AUTH_LIMIT' | 'API_LIMIT' | 'WS_IP_LIMIT' | 'WS_USER_LIMIT';

const ipLimit = (name: Limit) => limit(name, (c) => c.req.header('cf-connecting-ip') ?? 'local');
const userLimit = (name: Limit) => limit(name, (c) => String(c.get('user').id));

// Maintenance (spec 10, S-14): an admin is known from Access before any session, so the bypass works.
async function gate(c: Context<App>, next: Next) {
  const down = (await settings(c.env.DB)).maintenance && !(await isAdmin(c));
  return down ? fail(c, 503, 'maintenance', 'Down for maintenance') : next();
}

// One 404 and one error handler (task 8, ASVS 7.4.1): the most specific matched route pattern, never the URL, so an
// error in a scoped middleware names the route it served, and a generic 500 with the ray id.
const errorFields = (err: Error) => ({ name: err.name, message: String(err.message).slice(0, 200) });
const app = new Hono<App>().notFound((c) => fail(c, 404, 'not_found', 'Not found'));
app.onError((err, c) => {
  const ray = c.req.header('cf-ray') ?? 'local';
  log('error', { route: routePath(c, -1), method: c.req.method, ray, ...errorFields(err) });
  return fail(c, 500, 'internal', `Internal error (ref ${ray})`);
});

app.use(async (c, next) => {
  await next();
  c.header('Cache-Control', 'no-store');
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

// Request bodies (spec 3), for every route at once: at most 4 KB, counted as it is read when no length is declared.
app.use(bodyLimit({ maxSize: 4096, onError: (c) => fail(c, 400, 'bad_request', 'Body too large') }));

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

// Everything else under /api and /ws, by scope (spec 3.1), so a new route gets every step: the sign-in IP limit (not
// logout, which is limited per user, A-18); for a socket 426 without an upgrade, then its IP limit; the gate; then,
// on all but the public routes, session, ban and user limit. Logout takes the session and its limit only (A-29), and
// passes maintenance, so a user can always end a session.
// Unknown paths skip the per-route steps and answer 404.
const unrouted = (c: Context<App>) => !matchedRoutes(c).some((route) => route.method !== 'ALL');
const UNGATED = ['/api/health', '/api/admin/*', '/api/auth/logout'];
const EXEMPT = [...UNGATED, '/api/auth/google', '/api/auth/google/callback', '/api/auth/dev'];
const signedIn = (name: Limit) => except([...EXEMPT, unrouted], session, notBanned, userLimit(name));
const upgradeOnly = async (c: Context<App>, next: Next) =>
  isUpgrade(c) ? next() : fail(c, 426, 'upgrade_required', 'Expected a WebSocket upgrade');
app.use('/api/auth/*', except('/api/auth/logout', ipLimit('AUTH_LIMIT')));
app.use('/api/*', except(UNGATED, gate), signedIn('API_LIMIT'));
app.use('/ws/*', except(unrouted, upgradeOnly, ipLimit('WS_IP_LIMIT')), gate, signedIn('WS_USER_LIMIT'));

app.get('/api/auth/google', googleStart);
app.get('/api/auth/google/callback', googleCallback);
app.post('/api/auth/dev', devOnly, devLogin);
app.post('/api/auth/logout', session, userLimit('API_LIMIT'), logout);
app.get('/api/me', (c) => c.json(me(c.get('user'))));

// Upgrades (spec 2.3): the object gets the user and session expiry in headers that replace any client value; it has
// no public route. Its answer, a 101 or a refusal, is copied with the object's headers so the global no-store can
// be added to it.
async function forward(c: Context<App>, stub: DurableObjectStub) {
  const headers = new Headers(c.req.raw.headers);
  headers.set('x-conquer-uid', String(c.get('user').id));
  headers.set('x-conquer-exp', String(c.get('user').expires_at));
  const res = await stub.fetch(new Request(c.req.raw, { headers }));
  return new Response(res.body, res);
}
app.get('/ws/hub', (c) => forward(c, c.env.HUB.getByName('hub')));
app.get('/ws/game/:id', (c) => {
  let id: DurableObjectId;
  try {
    id = c.env.ROOMS.idFromString(c.req.param('id')); // a malformed id or another namespace's throws (P:120)
  } catch {
    return c.notFound();
  }
  return forward(c, c.env.ROOMS.get(id));
});

// The daily cron (task 8), a list of steps: M11 adds the D-25 resumption (A-2). Every step runs; each failure is
// logged, and one error after the last step makes the invocation show as failed.
const steps = [async (env: Env) => log('cron_sessions', { deleted: await db.expireSessions(env.DB, Date.now()) })];
async function scheduled(_: ScheduledController, env: Env) {
  const failed: Error[] = [];
  for (const step of steps) await step(env).catch((err) => failed.push(err));
  for (const err of failed) log('error', { route: 'cron', ...errorFields(err) });
  if (failed.length) throw new AggregateError(failed, 'Cron steps failed');
}

export default { fetch: app.fetch, scheduled } satisfies ExportedHandler<Env>;
