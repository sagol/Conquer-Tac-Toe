import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { fail, log } from './http.ts';
import type { App } from './index.ts';

// Cloudflare Access tokens (D-11, P:862), checked with jose against the team's keys: signature, issuer, audience,
// RS256 only, exp and nbf. Unset configuration fails closed. One key set per isolate.
export const JWT = { algorithms: ['RS256'], clockTolerance: 30 };
let keys: { team: string; jwks: ReturnType<typeof createRemoteJWKSet> } | undefined;

// The token's subject, or undefined when it is refused. An empty sub is a service token's (R:63): it passes only with
// `service`, since an admin is a person. A refusal is logged with its reason, never the token, unless `quiet`.
type Check = { service?: boolean; quiet?: boolean };
export async function verifyAccess(c: Context<App>, token?: string, aud?: string, { service, quiet }: Check = {}) {
  const team = c.env.ACCESS_TEAM_DOMAIN;
  let reason = token ? 'unset' : 'missing';
  if (team && aud && token) {
    if (keys?.team !== team) keys = { team, jwks: createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`)) };
    try {
      const { payload } = await jwtVerify(token, keys.jwks, { ...JWT, issuer: `https://${team}`, audience: aud });
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      if (sub || service) return { sub };
      reason = 'sub';
    } catch (err) {
      reason = (err as { code?: string }).code ?? 'invalid';
    }
  }
  if (!quiet) log('access_refused', { reason });
}

// Every /api/admin route, /admin and /admin/* (A-26). The admin's sub becomes audit_log.actor.
export async function access(c: Context<App>, next: Next) {
  const admin = await verifyAccess(c, c.req.header('cf-access-jwt-assertion'), c.env.ACCESS_AUD);
  if (!admin) return fail(c, 403, 'forbidden', 'Forbidden');
  c.set('admin', admin.sub);
  return next();
}

// The maintenance bypass off the admin paths (A-7, A-25): an admin token in the header or the CF_Authorization cookie,
// verified once when both hold the same token.
export async function isAdmin(c: Context<App>) {
  for (const token of new Set([c.req.header('cf-access-jwt-assertion'), getCookie(c, 'CF_Authorization')])) {
    if (await verifyAccess(c, token, c.env.ACCESS_AUD, { quiet: true })) return true;
  }
  return false;
}
