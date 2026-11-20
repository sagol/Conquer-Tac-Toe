import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { type App, fail, log } from './index.ts';

// Cloudflare Access tokens (D-11, P:862), checked with jose against the team's keys: signature, issuer, audience,
// RS256 only, exp and nbf. Unset configuration fails closed. One key set per isolate.
export const JWT = { algorithms: ['RS256'], clockTolerance: 30 };
let keys: { team: string; jwks: ReturnType<typeof createRemoteJWKSet> } | undefined;

// The token's subject ('' for a service token), or undefined when it is refused; a refusal is logged, never the
// token, unless `quiet`.
export async function verifyAccess(c: Context<App>, token: string | undefined, aud: string | undefined, quiet = false) {
  const team = c.env.ACCESS_TEAM_DOMAIN;
  let reason = token ? 'unset' : 'missing';
  if (team && aud && token) {
    if (keys?.team !== team) keys = { team, jwks: createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`)) };
    try {
      const { payload } = await jwtVerify(token, keys.jwks, { ...JWT, issuer: `https://${team}`, audience: aud });
      return typeof payload.sub === 'string' ? payload.sub : '';
    } catch (err) {
      reason = (err as { code?: string }).code ?? 'invalid';
    }
  }
  if (!quiet) log('access_refused', { reason });
}

// Every /api/admin route, /admin and /admin/* (A-26). An admin is a person: a service token's empty sub is refused,
// and the sub becomes audit_log.actor.
export async function access(c: Context<App>, next: Next) {
  const sub = await verifyAccess(c, c.req.header('cf-access-jwt-assertion'), c.env.ACCESS_AUD);
  if (sub === '') log('access_refused', { reason: 'sub' });
  if (!sub) return fail(c, 403, 'forbidden', 'Forbidden');
  c.set('admin', sub);
  return next();
}

// The maintenance bypass off the admin paths (A-7, A-25): an admin token in the header or the CF_Authorization cookie.
export async function isAdmin(c: Context<App>) {
  for (const token of [c.req.header('cf-access-jwt-assertion'), getCookie(c, 'CF_Authorization')]) {
    if (await verifyAccess(c, token, c.env.ACCESS_AUD, true)) return true;
  }
  return false;
}
