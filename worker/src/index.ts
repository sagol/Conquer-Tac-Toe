// The Worker (plan 4.1): one Hono app for the Worker-first paths of wrangler.jsonc (/api/*, /ws/*, /admin), the
// GameRoom and Hub classes and the daily cron. Static assets serve every other path, index.html for unknown ones.
import { variants } from 'engine/games';
import { type Context, Hono, type Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { access, isAdmin } from './admin.ts';
import { devLogin, devOnly, googleCallback, googleStart, logout, me, notBanned, session, userLimit } from './auth.ts';
import * as db from './db.ts';
import { fail, limited, log } from './http.ts';
import { getSettings, putSettings, settings } from './settings.ts';

export { Hub } from './hub.ts';
export { GameRoom } from './room.ts';

export type App = { Bindings: Env; Variables: { user: db.Session; admin: string } };
export type Limit = 'AUTH_LIMIT' | 'API_LIMIT' | 'WS_IP_LIMIT' | 'WS_USER_LIMIT';

const ipLimit = (name: Limit) => async (c: Context<App>, next: Next) =>
  (await limited(c, name, c.req.header('cf-connecting-ip') ?? 'local')) ?? next();

// Request bodies (spec 3): at most 4 KB, counted as it is read when no length is declared; readJson does the rest.
const json = bodyLimit({ maxSize: 4096, onError: (c) => fail(c, 400, 'bad_request', 'Body too large') });

// Maintenance (spec 10, S-14): an admin is known from Access before any session, so the bypass works.
async function gate(c: Context<App>, next: Next) {
  const down = (await settings(c.env.DB)).maintenance && !(await isAdmin(c));
  return down ? fail(c, 503, 'maintenance', 'Down for maintenance') : next();
}

// One 404 and one error handler (task 8, ASVS 7.4.1) for both apps: the route pattern, never the URL, and a generic
// 500 with the ray id.
const notFound = (c: Context<App>) => fail(c, 404, 'not_found', 'Not found');
const errorFields = (err: Error) => ({ name: err.name, message: String(err.message).slice(0, 200) });
function onError(err: Error, c: Context<App>) {
  const ray = c.req.header('cf-ray') ?? 'local';
  log('error', { route: c.req.routePath, method: c.req.method, ray, ...errorFields(err) });
  return fail(c, 500, 'internal', `Internal error (ref ${ray})`);
}

const app = new Hono<App>().notFound(notFound).onError(onError);

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

// Liveness: no settings and no session, so maintenance never blocks it (A-8); the count proves the registry loads.
app.get('/api/health', async (c) => {
  const up = await db.ping(c.env.DB).catch(() => null);
  return up ? c.json({ ok: true, variants: variants.length }) : fail(c, 503, 'unavailable', 'Database unavailable');
});

// Admin paths: Access first, registered before any admin route; no maintenance gate and no rate limit (A-18, A-26).
app.use('/api/admin/*', access);
app.get('/api/admin/settings', getSettings);
app.put('/api/admin/settings', json, putSettings);
app.on('GET', ['/admin', '/admin/*'], access, (c) => c.env.ASSETS.fetch(c.req.raw));

// The gated surface (spec 3.1, 10): sign-in, the session routes and the sockets, in an app of their own behind the
// gate, so health and the admin paths stay outside it whatever the order. Before it: Origin (above), the IP limits,
// and 426 for an upgrade path without an upgrade. Then session, ban and user limit (logout skips the ban, A-29).
const gated = new Hono<App>().notFound(notFound).onError(onError).use(gate);
gated.get('/api/auth/google', googleStart);
gated.get('/api/auth/google/callback', googleCallback);
gated.post('/api/auth/dev', devOnly, json, devLogin);
gated.post('/api/auth/logout', session, userLimit('API_LIMIT'), logout);
gated.get('/api/me', session, notBanned, userLimit('API_LIMIT'), (c) => c.json(me(c.get('user'))));
gated.on('GET', ['/ws/hub', '/ws/game/:id'], session, notBanned, userLimit('WS_USER_LIMIT'));

const upgradeOnly = (c: Context<App>, next: Next) =>
  isUpgrade(c) ? next() : fail(c, 426, 'upgrade_required', 'Expected a WebSocket upgrade');
app.use('/api/auth/*', ipLimit('AUTH_LIMIT'));
app.on('GET', ['/ws/hub', '/ws/game/:id'], upgradeOnly, ipLimit('WS_IP_LIMIT'));
app.on(['GET', 'POST'], ['/api/auth/*', '/api/me', '/ws/*'], (c) => gated.fetch(c.req.raw, c.env));

// Upgrades (spec 2.3): the object gets the user and session expiry in headers that replace any client value; it has
// no public route. Its 101 is rebuilt as the Worker's own, with the headers set so far (a slid cookie) and the global
// no-store, so an upgrade slides like any other call.
async function forward(c: Context<App>, stub: DurableObjectStub) {
  const headers = new Headers(c.req.raw.headers);
  headers.set('x-conquer-uid', String(c.get('user').id));
  headers.set('x-conquer-exp', String(c.get('user').expires_at));
  const res = await stub.fetch(new Request(c.req.raw, { headers }));
  return res.webSocket ? new Response(null, { status: 101, webSocket: res.webSocket, headers: c.res.headers }) : res;
}
gated.get('/ws/hub', (c) => forward(c, c.env.HUB.getByName('hub')));
gated.get('/ws/game/:id', (c) => {
  let id: DurableObjectId;
  try {
    id = c.env.ROOMS.idFromString(c.req.param('id')); // a malformed id or another namespace's throws (P:120)
  } catch {
    return c.notFound();
  }
  return forward(c, c.env.ROOMS.get(id));
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
