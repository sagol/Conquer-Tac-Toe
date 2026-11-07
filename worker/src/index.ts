import { DurableObject } from 'cloudflare:workers';

// Placeholders until the API and the rooms are built. Every environment binds both classes, so a deploy needs them.
export class GameRoom extends DurableObject {}
export class Hub extends DurableObject {}

export default { fetch: () => new Response(null, { status: 404 }) } satisfies ExportedHandler;
