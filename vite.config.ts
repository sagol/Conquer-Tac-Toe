import { dirname, resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig, type Plugin, parseSync } from 'vite';

const games = resolve(import.meta.dirname, 'engine/src/games');

// Bot code never reaches the browser. In the web build every dynamic import under
// engine/src/games becomes a rejected promise, so bot modules and their data stay out of the
// bundle; a chunk that still holds one of them, or any generated file, fails the build.
function botStub(): Plugin {
  const bots = new Set<string>();
  return {
    name: 'bot-stub',
    applyToEnvironment: (env) => env.name === 'client',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.startsWith(`${games}/`)) return;
      for (const { start, end, moduleRequest } of parseSync(file, code).module.dynamicImports.toReversed()) {
        bots.add(resolve(dirname(file), code.slice(moduleRequest.start + 1, moduleRequest.end - 1)));
        code = `${code.slice(0, start)}Promise.reject(new Error('no bot code in the browser'))${code.slice(end)}`;
      }
      return code;
    },
    generateBundle(_, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const leak = chunk.moduleIds.find((id) => bots.has(id) || id.endsWith('.gen.ts'));
        if (leak) this.error(`${leak} reached the web build in ${chunk.fileName}`);
      }
    },
  };
}

export default defineConfig({ plugins: [cloudflare(), botStub()] });
