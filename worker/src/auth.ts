import type { Context, Next } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { base64url, createRemoteJWKSet, jwtVerify } from 'jose';
import { JWT, verifyAccess } from './admin.ts';
import * as db from './db.ts';
import { fail, log, readJson } from './http.ts';
import type { App } from './index.ts';
import { settings } from './settings.ts';

// Google sign-in, dev login and sessions (plan 4.2, M5 tasks 2 and 3). A session is 32 random bytes in a __Host-
// cookie; D1 holds only its SHA-256, so there is no signing key (4.5).
const LIFE = 30 * 86_400_000; // absolute from sign-in, never extended (ASVS 3.3.2)
const COOKIE = { prefix: 'host', httpOnly: true, sameSite: 'Lax' } as const; // Secure, Path=/, no Domain
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const enc = new TextEncoder();
// Removed from names: controls, format characters (bidi overrides among them), private-use and unassigned code
// points. Whitespace, ZWNJ and ZWJ stay: some scripts and emoji sequences need the joiners.
const CONTROL = /[^\P{C}\s\u200c\u200d]/gu;

const random = () => base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = (text: string) => crypto.subtle.digest('SHA-256', enc.encode(text));
const hashOf = async (sid: string) =>
  Array.from(new Uint8Array(await sha256(sid)), (b) => b.toString(16).padStart(2, '0')).join('');
const u32 = () => crypto.getRandomValues(new Uint32Array(1))[0];
const timingSafe = (a: Uint8Array, b: Uint8Array) => a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
const isBanned = (u: db.User) => (u.banned_until ?? 0) > Date.now();
const banned = (c: Context<App>, u: db.User) => fail(c, 403, 'banned', 'Banned', { until: u.banned_until });
const callbackUrl = (c: Context<App>) => `${new URL(c.req.url).origin}/api/auth/google/callback`;

// The caller's own allow-listed fields and nothing else (S-05).
export const me = (u: db.User) => ({ id: u.id, handle: u.handle, name: u.name, createdAt: u.created_at });

// Routes that need a session: 401 when it is missing, expired or its user deleted.
export async function session(c: Context<App>, next: Next) {
  const sid = getCookie(c, 'sid', 'host');
  const s = sid ? await db.session(c.env.DB, await hashOf(sid)) : null;
  if (!sid || !s || s.expires_at <= Date.now() || s.deleted_at !== null) {
    deleteCookie(c, 'sid', COOKIE);
    return fail(c, 401, 'unauthorized', 'Sign in first');
  }
  c.set('user', s);
  return next();
}

// After the session: the ban (every session route but logout, A-29).
export const notBanned = async (c: Context<App>, next: Next) => (isBanned(c.var.user) ? banned(c, c.var.user) : next());

// A new session at every sign-in (ASVS 3.2.1): the one this browser presented is deleted in the same batch. Its
// expiry and the cookie's Max-Age are set here once, so the cookie lives exactly as long as the session.
async function signIn(c: Context<App>, uid: number) {
  const old = getCookie(c, 'sid', 'host');
  const sid = random();
  await db.swapSession(c.env.DB, old ? await hashOf(old) : '', await hashOf(sid), uid, Date.now() + LIFE);
  setCookie(c, 'sid', sid, { ...COOKIE, maxAge: LIFE / 1000 });
}

// A new user with a random id below 2^53 (4.3). A UNIQUE clash on the id or the handle retries with new values, at
// most five times; one on google_sub (two callbacks raced) returns the row the other wrote.
async function create(d1: D1Database, u: db.NewUser, handle: (i: number) => string) {
  for (let i = 0; i < 5; i++) {
    try {
      return await db.addUser(d1, (u32() & 0x1fffff) * 2 ** 32 + u32() || 1, handle(i), u, Date.now());
    } catch (err) {
      if (!/UNIQUE/.test(String(err))) throw err;
      if (u.google_sub && /google_sub/.test(String(err))) return db.userBySub(d1, u.google_sub);
    }
  }
  return null;
}

// GET /api/auth/google: state and a PKCE verifier in a 10-minute cookie, then Google's consent screen.
export async function googleStart(c: Context<App>) {
  const id = c.env.GOOGLE_CLIENT_ID;
  if (!id) return fail(c, 503, 'unavailable', 'Google sign-in is not configured');
  const [state, verifier] = [random(), random()];
  setCookie(c, 'oauth', `${state}.${verifier}`, { ...COOKIE, maxAge: 600 });
  const query = new URLSearchParams({ client_id: id, response_type: 'code', scope: 'openid email profile', state });
  query.set('redirect_uri', callbackUrl(c));
  query.set('code_challenge', base64url.encode(new Uint8Array(await sha256(verifier))));
  query.set('code_challenge_method', 'S256');
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${query}`);
}

// Refusals go to fixed same-origin paths only (A-24, ASVS 5.1.5); a ban's reason never travels in a URL.
function refuse(c: Context<App>, reason: string, until?: number | null) {
  log('signin_refused', { reason });
  const code = reason === 'state' || reason === 'token' ? 'failed' : reason;
  return c.redirect(`/?auth=${code}${until ? `&until=${until}` : ''}`);
}

// The code exchange and the ID token's checks (signature, issuer, audience, RS256, exp, nbf); the access and refresh
// tokens are dropped unread (S-06). The caller turns any failure, the network's included, into a refusal.
async function googleClaims(c: Context<App>, code: string, verifier: string) {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: secret } = c.env;
  if (!clientId || !secret) return;
  const body = new URLSearchParams({ code, client_id: clientId, client_secret: secret, code_verifier: verifier });
  body.set('redirect_uri', callbackUrl(c));
  body.set('grant_type', 'authorization_code');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const token = res.ok ? (await res.json<{ id_token?: unknown }>()).id_token : undefined;
  if (typeof token !== 'string') return;
  const issuer = ['https://accounts.google.com', 'accounts.google.com'];
  const { payload: p } = await jwtVerify(token, googleKeys, { ...JWT, issuer, audience: clientId });
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return text(p.sub) ? { google_sub: text(p.sub), email: text(p.email) || null, name: text(p.name) } : undefined;
}

// GET /api/auth/google/callback. The state cookie is cleared on every outcome; state and code must each appear once.
export async function googleCallback(c: Context<App>) {
  const [state = '', verifier] = (deleteCookie(c, 'oauth', COOKIE) ?? '').split('.');
  const [given, code] = [c.req.queries('state') ?? [], c.req.queries('code') ?? []];
  const stateOk = verifier && given.length === 1 && timingSafe(enc.encode(state), enc.encode(given[0]));
  if (!stateOk || c.req.query('error') !== undefined) return refuse(c, 'state');
  const claims = code.length === 1 ? await googleClaims(c, code[0], verifier).catch(() => undefined) : undefined;
  if (!claims) return refuse(c, 'token');
  let user = await db.userBySub(c.env.DB, claims.google_sub); // D-25: a deleted account counts as absent
  if (user && isBanned(user)) return refuse(c, 'banned', user.banned_until);
  if (!user && !(await settings(c.env.DB)).registrations) return refuse(c, 'closed'); // S-08
  const created = !user;
  // The name without CONTROL characters, whitespace collapsed, at most 32 characters. The handle (A-23): the name
  // NFKD-folded, lowercased, and only ASCII a-z and 0-9 kept (combining marks go with the rest), so no other script
  // and no cross-script lookalike survives; 3 to 20 of them, or with fewer "player". "player" and every retry after a
  // clash put six random digits after the first 14, so clashes stay rare however many names share a base. Never the
  // email.
  const name =
    [...claims.name.replace(CONTROL, '').replace(/\s+/g, ' ').trim()].slice(0, 32).join('').trim() || 'Player';
  const folded = name.normalize('NFKD').toLowerCase();
  const ascii = folded.replace(/[^a-z0-9]/g, '');
  const base = ascii.length >= 3 ? ascii.slice(0, 20) : '';
  const handle = (i: number) =>
    base && !i ? base : (base || 'player').slice(0, 14) + String(u32() % 1e6).padStart(6, '0');
  user ??= await create(c.env.DB, { ...claims, name }, handle);
  if (!user) return refuse(c, 'failed');
  await signIn(c, user.id);
  log('signin', { uid: user.id, created });
  return c.redirect('/');
}

// POST /api/auth/dev (D-12): absent without DEV_LOGIN, answering as an unknown route does, before the body is read.
// Fail closed (A-10): with STAGING_AUD set the staging Access token is required whatever the host, a service token's
// included; without it only localhost passes.
export async function devOnly(c: Context<App>, next: Next) {
  if (c.env.DEV_LOGIN !== '1') return c.notFound();
  const aud = c.env.STAGING_AUD;
  const passed = aud
    ? await verifyAccess(c, c.req.header('cf-access-jwt-assertion'), aud, { service: true })
    : ['localhost', '127.0.0.1'].includes(new URL(c.req.url).hostname);
  return passed ? next() : fail(c, 403, 'forbidden', 'Forbidden');
}

// Dev users have no Google subject, a row that has one is never signed in here, and registrations do not apply (A-9).
export async function devLogin(c: Context<App>) {
  const name = (await readJson(c))?.name;
  if (typeof name !== 'string' || !/^[a-z0-9]{1,20}$/.test(name)) return fail(c, 400, 'bad_request', 'Bad name');
  const find = () => db.userByHandle(c.env.DB, `dev-${name}`);
  const dev = { google_sub: null, email: null, name };
  const user = (await find()) ?? (await create(c.env.DB, dev, () => `dev-${name}`)) ?? (await find());
  if (!user || user.google_sub !== null || user.deleted_at !== null) return fail(c, 403, 'forbidden', 'Forbidden');
  if (isBanned(user)) return banned(c, user);
  await signIn(c, user.id);
  log('dev_login', { uid: user.id });
  return c.json(me(user));
}

// POST /api/auth/logout: the Hub closes the user's sockets first (4.2 Revocation); if it fails the session stays and
// the client retries.
export async function logout(c: Context<App>) {
  const { id: uid, id_hash } = c.get('user');
  const stub = c.env.HUB.getByName('hub');
  const revoked = await stub.revoke(uid).catch(() => false);
  if (!revoked) return fail(c, 503, 'unavailable', 'Try again');
  await db.endSession(c.env.DB, id_hash).run();
  deleteCookie(c, 'sid', COOKIE);
  log('logout', { uid });
  return c.body(null, 204);
}
