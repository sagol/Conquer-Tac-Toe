// Bundle budgets in KB gzipped, read from the web build that `vite build` leaves in dist/client.
// The build itself fails when a bot module or generated data reaches it (vite.config.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const CAP = { initial: 90, route: 40, css: 20 };
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
if (initialKb > CAP.initial) errors.push(`initial JavaScript: ${initialKb.toFixed(1)} KB, over ${CAP.initial} KB`);
for (const file of routes) {
  if (kb(file) > CAP.route) errors.push(`${file}: ${kb(file).toFixed(1)} KB, over ${CAP.route} KB`);
}
if (cssKb > CAP.css) errors.push(`CSS: ${cssKb.toFixed(1)} KB, over ${CAP.css} KB`);

console.log(
  `bundle: initial JS ${initialKb.toFixed(1)}/${CAP.initial} KB, ${routes.length} route chunks, CSS ${cssKb.toFixed(1)}/${CAP.css} KB gzipped`,
);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
