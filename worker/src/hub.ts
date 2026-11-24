import { DurableObject } from 'cloudflare:workers';
import { accept } from './room.ts';

// Hub (plan 4.1, 4.2), the one instance, env.HUB.getByName('hub'): M5's stub, whose body M7 replaces. revoke() has no
// sockets to close yet, so it acknowledges at once (spec A-4); logout already waits for it.
export class Hub extends DurableObject<Env> {
  async fetch(req: Request) {
    return accept(this.ctx, req);
  }

  async revoke(_uid: number): Promise<true> {
    return true;
  }
}
