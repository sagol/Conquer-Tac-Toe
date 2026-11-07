// engine/src/games/index.ts: the registry a new game edits (D-18).
import type { Variant } from '../game.ts';
import rings from './rings/index.ts'; // each family default-exports Variant[]; rings: the five launch arenas

export const variants: readonly Variant[] = [...rings]; // lobby order; an added family brings one import and one spread
export const byId = new Map(variants.map((v) => [v.id, v]));
