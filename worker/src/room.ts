import { DurableObject } from 'cloudflare:workers';

// GameRoom (plan 4.1, 4.2), one per game: M5's stub, whose body M6 replaces. The Worker forwards an upgrade only
// after its checks, with the user and the session's expiry in headers no client can set (index.ts, forward).
export class GameRoom extends DurableObject<Env> {
  async fetch(req: Request) {
    return accept(this.ctx, req);
  }
}

// A socket's attachment is {uid, exp} (4.2 Sockets); anything but an upgrade is unknown here.
export function accept(ctx: DurableObjectState, req: Request) {
  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response(null, { status: 404 });
  const [client, server] = Object.values(new WebSocketPair());
  ctx.acceptWebSocket(server);
  const header = (name: string) => Number(req.headers.get(`x-conquer-${name}`));
  server.serializeAttachment({ uid: header('uid'), exp: header('exp') });
  return new Response(null, { status: 101, webSocket: client });
}
