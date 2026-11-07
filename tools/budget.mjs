// Code budgets, dependency lists and import boundaries, run by `pnpm verify`. It prints the line counts
// and fails with every broken rule it finds.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync, Visitor } from 'vite';

const root = resolve(import.meta.dirname, '..');
const GAMES = 'engine/src/games/';

// Caps in code lines; a family declares its own in a `// budget: N lines, M KB` header in index.ts.
const CAPS = { kernel: 740, worker: 1700, web: 4000 };
const TOTAL = 7800;
const HEADER = /^\/\/ budget: (\d+) lines, (\d+) KB(?:, (\S+) (\d+) KB)?$/m;
const ANY_HEADER = /^\s*\/[/*]+\s*budget\b/im; // a header line that HEADER must then parse
const DEFAULT_HEADER = { lines: 400, kb: 200 };
const MAX_FAMILY_LINES = 1000;
const MAX_DATA_KB = 4096;

// The complete dependency lists, each version pinned exactly.
const LISTS = {
  dependencies: ['react', 'react-dom', 'wouter', 'hono', 'arctic', 'jose'],
  devDependencies: [
    'typescript',
    'vite',
    '@cloudflare/vite-plugin',
    'wrangler',
    '@biomejs/biome',
    '@types/react',
    '@types/react-dom',
    '@types/node',
  ],
};
const PACKAGES = ['engine', 'worker', 'web'];
// self and window are globalThis under other names.
const NOT_IN_GAMES = new Set(['Date', 'performance', 'crypto', 'fetch', 'globalThis', 'self', 'window']);

const errors = [];
const read = (file) => readFileSync(join(root, file), 'utf8');

// The workspace holds the three packages, and nothing in it changes what the lists install.
const workspace = read('pnpm-workspace.yaml');
const block = /^packages:\n((?:[ \t]+.*\n)*)/m.exec(workspace)?.[1] ?? '';
const members = [...block.matchAll(/-\s*['"]?([^\s'"#]+)/g)].map((m) => m[1]);
if (members.join() !== PACKAGES.join()) errors.push(`pnpm-workspace.yaml: packages must be ${PACKAGES.join(', ')}`);
for (const [, key] of workspace.matchAll(/^(overrides|catalogs?|patchedDependencies|packageExtensions)\s*:/gm)) {
  errors.push(`pnpm-workspace.yaml: the ${key} setting is not allowed`);
}

const declared = new Set();
for (const dir of new Set(['.', ...PACKAGES, ...members])) {
  const file = join(dir, 'package.json');
  if (!existsSync(join(root, file))) continue;
  const pkg = JSON.parse(read(file));
  for (const field of ['peerDependencies', 'optionalDependencies', 'overrides', 'resolutions', 'pnpm']) {
    if (pkg[field]) errors.push(`${file}: the ${field} field is not allowed`);
  }
  for (const [field, list] of Object.entries(LISTS)) {
    for (const [name, version] of Object.entries(pkg[field] ?? {})) {
      if (PACKAGES.includes(name) && version === 'workspace:*') continue;
      if (!list.includes(name)) errors.push(`${file}: ${name} is not on the ${field} list`);
      else if (!/^\d+\.\d+\.\d+$/.test(version)) errors.push(`${file}: ${name} ${version} is not an exact version`);
      if (declared.has(name)) errors.push(`${file}: ${name} is declared twice`);
      declared.add(name);
    }
  }
}
for (const name of Object.values(LISTS).flat()) {
  if (!declared.has(name)) errors.push(`${name} from the dependency lists is not declared`);
}

// Level rows are data: every target fits BOT_MS. Variant ids may not appear outside the games folder.
const { variants } = await import(pathToFileURL(join(root, GAMES, 'index.ts')).href);
if (variants.length) {
  const { BOT_MS } = await import(pathToFileURL(join(root, 'engine/src/game.ts')).href);
  for (const v of variants) {
    v.levels.forEach((level, i) => {
      if (!(level.ms <= BOT_MS)) errors.push(`${v.id} level ${i + 1}: ms ${level.ms} is above BOT_MS ${BOT_MS}`);
    });
  }
}
const ids = new Set(variants.map((v) => v.id));

// A unit is the kernel, the worker, the web, the registry (games/index.ts) or a family folder, with or
// without its index.ts; a folder below a family with its own index.ts (rings/gomoku) is a unit of its own
// under its own header.
function unitOf(file) {
  if (!file.startsWith(GAMES)) return file.startsWith('engine/src/') ? 'kernel' : file.split('/')[0];
  for (let dir = dirname(file); dir.length >= GAMES.length; dir = dirname(dir)) {
    if (existsSync(join(root, dir, 'index.ts'))) return dir.slice(GAMES.length);
  }
  const [family, ...rest] = file.slice(GAMES.length).split('/');
  return rest.length ? family : 'registry';
}

function header(unit) {
  const file = `${GAMES}${unit}/index.ts`;
  const m = existsSync(join(root, file)) && HEADER.exec(read(file));
  return m ? { lines: +m[1], kb: +m[2], file: m[3], fileKb: +m[4] } : DEFAULT_HEADER;
}

// Lines that hold code: comments become blanks, then blank lines are dropped.
function codeLines(text, comments) {
  let code = text;
  for (const { start, end } of comments) {
    code = code.slice(0, start) + code.slice(start, end).replace(/[^\n]/g, ' ') + code.slice(end);
  }
  return code.split('\n').filter((line) => line.trim()).length;
}

const lines = {};
const data = [];
const staticTargets = [];
const botModules = new Set();
const files = ['engine/src', 'worker/src', 'web/src', 'tools'].flatMap((dir) =>
  readdirSync(join(root, dir), { recursive: true })
    .map((name) => `${dir}/${name}`)
    .filter((file) => /\.([cm]?[jt]sx?|css)$/.test(file)),
);

for (const file of files) {
  const unit = unitOf(file);
  const text = read(file);
  const count = (n) => {
    if (unit !== 'tools') lines[unit] = (lines[unit] ?? 0) + n;
  };
  if (unit === 'registry' && file !== `${GAMES}index.ts`) errors.push(`${file}: only index.ts lives in ${GAMES}`);
  if (file === `${GAMES}${unit}/index.ts` && ANY_HEADER.test(text) && !HEADER.test(text)) {
    errors.push(`${file}: malformed budget header, expected // budget: N lines, M KB`);
  }
  if (file.endsWith('.css')) {
    const comments = [...text.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => ({
      start: m.index,
      end: m.index + m[0].length,
    }));
    count(codeLines(text, comments));
    continue;
  }
  const parsed = parseSync(file, text);
  if (parsed.errors.length) {
    errors.push(`${file}: ${parsed.errors[0].message}`);
    continue;
  }
  // Generated files cost no lines; every other rule applies to them.
  const generated = file.endsWith('.gen.ts');
  count(generated ? 0 : codeLines(text, parsed.comments));
  if (generated) {
    data.push({ file, unit, kb: statSync(join(root, file)).size / 1024 });
    if (!file.startsWith(GAMES)) errors.push(`${file}: generated files live only in game folders`);
  }

  const target = (spec) => (spec?.startsWith('.') ? relative(root, resolve(root, dirname(file), spec)) : undefined);
  const imports = [
    ...parsed.module.staticImports.map((i) => i.moduleRequest.value),
    ...parsed.module.staticExports.flatMap((e) => e.entries.map((x) => x.moduleRequest?.value).filter(Boolean)),
  ].map((spec) => ({ spec, target: target(spec) }));
  const dynamic = parsed.module.dynamicImports.map((d) => {
    const spec = /^(['"])(.*)\1$/.exec(text.slice(d.moduleRequest.start, d.moduleRequest.end))?.[2];
    return { spec, target: target(spec), start: d.start, end: d.end };
  });
  staticTargets.push(...imports.map((i) => ({ file, target: i.target })));
  // A relative import names its file exactly, so one module has one spelling (no ./bot.js for bot.ts, no query).
  for (const { spec, target: to } of [...imports, ...dynamic]) {
    if (to && !existsSync(join(root, to))) errors.push(`${file}: imports ${spec}, which is not a file`);
  }

  const botSpans = [];
  const literals = [];
  const used = [];
  const names = new Set(); // starts of identifiers that name a property rather than read a value
  const keyName = (key) => key.name ?? key.value;
  const key = (n) => {
    if (n.computed) return;
    if (!n.shorthand) names.add(n.key.start);
    if (n.key.type === 'Identifier') literals.push(n.key.name);
  };
  new Visitor({
    Property(n) {
      key(n);
      if (keyName(n.key) === 'bot' && /Function/.test(n.value.type)) botSpans.push(n.value);
    },
    TSPropertySignature: key,
    MemberExpression(n) {
      if (n.computed) return;
      names.add(n.property.start);
      if (n.object.name === 'Math' && n.property.name !== 'random') names.add(n.object.start);
    },
    Identifier(n) {
      if (names.has(n.start)) return;
      if (NOT_IN_GAMES.has(n.name)) used.push(n.name);
      // Math only as Math.<name>, so no computed key, alias or destructuring reaches Math.random.
      if (n.name === 'Math') used.push('Math.random');
    },
    Literal(n) {
      if (typeof n.value === 'string') literals.push(n.value);
    },
    TemplateElement(n) {
      literals.push(n.value.cooked);
    },
    JSXText(n) {
      literals.push(n.value.trim());
    },
  }).visit(parsed.program);

  if (file.startsWith('engine/src/')) {
    for (const { spec, target: to } of [...imports, ...dynamic]) {
      if (!to?.startsWith('engine/src/'))
        errors.push(`${file}: imports ${spec ?? 'a computed path'}; engine files import only engine/src`);
      else if (unit === 'kernel' && to.startsWith(GAMES))
        errors.push(`${file}: the kernel never imports games/ (${spec})`);
    }
  }
  if (file.startsWith(GAMES)) {
    for (const name of new Set(used)) errors.push(`${file}: game folders never use ${name}`);
    for (const { spec, target: to } of imports) {
      if (!to?.startsWith(GAMES)) continue;
      const toUnit = unitOf(to);
      const allowed =
        unit === 'registry'
          ? !toUnit.includes('/') && to === `${GAMES}${toUnit}/index.ts`
          : toUnit === unit || unit.startsWith(`${toUnit}/`);
      if (!allowed) {
        errors.push(
          `${file}: imports ${spec}; a family imports only kernel files and its own folder, a nested folder only through bot()`,
        );
      }
    }
    const family = `${GAMES}${unit.split('/')[0]}/`;
    for (const { spec, target: to, start, end } of dynamic) {
      if (!botSpans.some((s) => s.start <= start && end <= s.end))
        errors.push(`${file}: a dynamic import is allowed only in Variant.bot()`);
      if (unit === 'registry' || !to?.startsWith(family))
        errors.push(`${file}: bot() must load a file of its own family, not ${spec ?? 'a computed path'}`);
      else botModules.add(to);
    }
  } else {
    for (const s of new Set(literals))
      if (ids.has(s)) errors.push(`${file}: the variant id '${s}' appears outside ${GAMES}`);
  }
  if (unit === 'worker' || unit === 'web') {
    for (const { spec, target: to } of [...imports, ...dynamic]) {
      if (to && !to.startsWith(`${unit}/`)) errors.push(`${file}: imports ${spec} from outside the ${unit} package`);
    }
  }
}

for (const { file, target } of staticTargets) {
  if (botModules.has(target)) errors.push(`${file}: imports the bot module ${target} statically`);
}

// Caps: the units above, every family header, the measured total and the data total.
const total = Object.values(lines).reduce((sum, n) => sum + n, 0);
for (const [unit, cap] of Object.entries(CAPS)) {
  if ((lines[unit] ?? 0) > cap) errors.push(`${unit}: ${lines[unit]} code lines, over its cap of ${cap}`);
}
const families = Object.keys(lines).filter((unit) => !(unit in CAPS) && unit !== 'registry');
for (const unit of families) {
  const { lines: cap } = header(unit);
  if (cap > MAX_FAMILY_LINES) errors.push(`${unit}: its header cap of ${cap} lines is above ${MAX_FAMILY_LINES}`);
  if (lines[unit] > cap) errors.push(`${unit}: ${lines[unit]} code lines, over its header cap of ${cap}`);
}
for (const { file, unit, kb } of data) {
  const h = header(unit);
  const cap = h.file && file.endsWith(`/${h.file}`) ? h.fileKb : h.kb;
  if (kb > cap) errors.push(`${file}: ${kb.toFixed(1)} KB, over its cap of ${cap} KB`);
}
const dataKb = data.reduce((sum, d) => sum + d.kb, 0);
if (total > TOTAL) errors.push(`product: ${total} code lines, over the measured total of ${TOTAL}`);
if (dataKb > MAX_DATA_KB) errors.push(`generated data: ${dataKb.toFixed(1)} KB, over ${MAX_DATA_KB} KB`);

const shown = [...Object.keys(CAPS), ...families].map((u) => `${u} ${lines[u] ?? 0}/${CAPS[u] ?? header(u).lines}`);
console.log(
  `budget: ${shown.join(', ')}, total ${total}/${TOTAL} code lines; data ${dataKb.toFixed(1)}/${MAX_DATA_KB} KB`,
);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
