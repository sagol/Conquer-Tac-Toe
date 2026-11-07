// Bundle budgets, read from the web build that `vite build` leaves in dist/client:
// initial JavaScript at most 90 KB gzipped, each route chunk at most 40 KB and CSS at most 20 KB.
// The build itself fails when a bot module or generated data reaches it (vite.config.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = join(import.meta.dirname, '../dist/client');
const kb = (file) => gzipSync(readFileSync(join(dir, file))).length / 1024;
const sum = (files) => files.reduce((total, file) => total + kb(file), 0);
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const initial = new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]));
const assets = readdirSync(join(dir, 'assets')).map((file) => `assets/${file}`);
const js = assets.filter((file) => file.endsWith('.js'));
const routes = js.filter((file) => !initial.has(file));

const errors = [];
const initialKb = sum([...initial]);
const cssKb = sum(assets.filter((file) => file.endsWith('.css')));
if (initialKb > 90) errors.push(`initial JavaScript: ${initialKb.toFixed(1)} KB, over 90 KB`);
for (const file of routes) if (kb(file) > 40) errors.push(`${file}: ${kb(file).toFixed(1)} KB, over 40 KB`);
if (cssKb > 20) errors.push(`CSS: ${cssKb.toFixed(1)} KB, over 20 KB`);

console.log(
  `bundle: initial JS ${initialKb.toFixed(1)}/90 KB, ${routes.length} route chunks, CSS ${cssKb.toFixed(1)}/20 KB gzipped`,
);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
