// node tools/book.ts <variant> --out <path> [--opts k=v,...]... --plies N
//
// Writes a book of proved values for a variant whose ceiling is exact (7.3). From the start of each option set it
// walks level 5's strategy tree for both seats, level 5 with no node limit, no noise and no book, and records
// (Bot.key, Choice.value) for every exact choice in the first N plies. The book goes to <path>, grouped by value,
// sorted and delta-encoded, with this command in its header. Worker threads solve the positions of each ply.
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { plays } from '../engine/src/bot/policy.ts';
import type { Bot, Five, Level, Opts, Position, Variant } from '../engine/src/game.ts';
import { byId } from '../engine/src/games/index.ts';
import { checkOpts, replay } from '../engine/src/play.ts';
import { random } from '../engine/src/random.ts';

const TABLE = 23; // log2 entries of each thread's search table, kept across its positions: 8M entries, 192 MB

// A position as the option set and the names that reach it.
export interface Start {
  opts: Opts;
  moves: readonly string[];
}
interface Solved {
  key: number;
  value?: number;
  move: string;
}

// Level 5 with no node limit, no noise and no book: its key, its value when the choice is exact, and the first of
// the moves it may play.
function solver(v: Variant, b: Bot) {
  const rows = v.levels.map((row, i) => (i === 4 ? { ...row, nodes: Infinity, noise: 0 } : row));
  const five = { ...v, levels: rows as unknown as Five<Level> };
  const bare = { ...b, book: undefined };
  return (p: Position, key: number): Solved => {
    const r = plays(five, bare, p, 5, random(0), TABLE);
    return { key, ...(r.exact && { value: r.value }), move: p.name(r.moves[0]) };
  };
}

// The book of v from the starts, `plies` deep: each key of a position where level 5 moves, with its value for the
// side to move. Positions are walked by ply, each key once per tree, so mirrors and transpositions share a walk.
export async function walk(v: Variant, starts: readonly Start[], plies: number, threads = availableParallelism()) {
  const b = await v.bot();
  const { key } = b;
  if (!key) throw new Error(`${v.id}: a book needs Bot.key`);
  const keyOf = (p: Position) => key(b.fast?.(p) ?? p);
  const workers = Array.from({ length: threads }, () =>
    new Worker(new URL(import.meta.url), { workerData: { walk: v.id } }).on('error', (e) => {
      throw e;
    }),
  );
  const solve = solver(v, b);
  // Each job goes to the next idle thread, or is solved here when there are none.
  const run = async (jobs: (Start & { key: number })[]) => {
    if (!workers.length) return jobs.map((j) => solve(replay(v, j.opts, j.moves).pos, j.key));
    const out: Solved[] = [];
    let next = 0;
    const feed = (w: Worker) =>
      new Promise<void>((done) => {
        const send = () => {
          const i = next++;
          if (i >= jobs.length) return done();
          w.once('message', (r: Solved) => {
            out[i] = r;
            send();
          });
          w.postMessage(jobs[i]);
        };
        send();
      });
    await Promise.all(workers.map(feed));
    return out;
  };
  const book = new Map<number, number>();
  const seen = new Set<number>();
  let level = starts.flatMap((s) => [0, 1].map((tree) => ({ ...s, tree })));
  try {
    for (let ply = 0; ply < plies && level.length; ply++) {
      const next: typeof level = [];
      const mine: ((typeof level)[number] & { key: number })[] = [];
      for (const n of level) {
        const { pos } = replay(v, n.opts, n.moves);
        const t = pos.turn();
        if (typeof t === 'object') continue;
        const k = keyOf(pos);
        if (seen.has(k * 2 + n.tree)) continue;
        seen.add(k * 2 + n.tree);
        if (t === n.tree) mine.push({ ...n, key: k });
        else for (const m of [...pos.moves()]) next.push({ ...n, moves: [...n.moves, pos.name(m)] });
      }
      const solved = await run(mine);
      mine.forEach((n, i) => {
        const r = solved[i];
        if (r.value !== undefined) book.set(r.key, r.value);
        next.push({ ...n, moves: [...n.moves, r.move] });
      });
      level = next;
    }
  } finally {
    for (const w of workers) await w.terminate();
  }
  return book;
}

// Keys grouped by value (-1, 0, 1), each group sorted and written as base-36 differences: the format of Bot.book.
export function encode(book: Map<number, number>): string {
  const groups: number[][] = [[], [], []];
  for (const [key, value] of book) groups[value + 1].push(key);
  return groups
    .map((keys) =>
      keys
        .sort((a, b) => a - b)
        .map((k, i) => (k - (i ? keys[i - 1] : 0)).toString(36))
        .join(','),
    )
    .join(';');
}

if (!isMainThread && workerData?.walk) {
  const v = byId.get(workerData.walk);
  if (!v || !parentPort) throw new Error(`no variant ${workerData.walk}`);
  const solve = solver(v, await v.bot());
  const port = parentPort;
  port.on('message', (j: Start & { key: number }) => port.postMessage(solve(replay(v, j.opts, j.moves).pos, j.key)));
} else if (import.meta.main) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, opts: { type: 'string', multiple: true }, plies: { type: 'string' } },
  });
  const v = byId.get(positionals[0] ?? '');
  const plies = Number(values.plies);
  if (!v || !values.out || !(plies > 0))
    throw new Error('usage: node tools/book.ts <variant> --out <path> [--opts k=v,...]... --plies N');
  const sets = (values.opts ?? ['']).map((text) =>
    checkOpts(
      v,
      Object.fromEntries(
        text
          .split(',')
          .filter(Boolean)
          .map((kv) => [kv.split('=')[0], Number(kv.split('=')[1])]),
      ),
    ),
  );
  for (const o of sets)
    if (v.ceiling(o) !== 'exact') throw new Error(`${v.id} ${JSON.stringify(o)}: the ceiling is not exact`);
  const book = await walk(
    v,
    sets.map((opts) => ({ opts, moves: [] })),
    plies,
  );
  const count = (x: number) => [...book.values()].filter((y) => y === x).length;
  const command = ['node tools/book.ts', ...process.argv.slice(2)].join(' ');
  writeFileSync(
    values.out,
    `// Generated by tools/book.ts; reproduce with: ${command}\n` +
      `// ${book.size} positions where level 5 moves: ${count(1)} won, ${count(0)} drawn, ${count(-1)} lost for it.\n` +
      `export default '${encode(book)}';\n`,
  );
  console.log(`${values.out}: ${book.size} positions`);
}
