import { resolve } from 'node:path';
import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig, type Plugin, parseSync } from 'vite';

const games = resolve(import.meta.dirname, 'engine/src/games');

// Bot code never reaches the browser. In the web build every dynamic import under
// engine/src/games becomes a rejected promise, so bot modules and their data stay out of the
// bundle; an output that still holds one of them, or any generated file, fails the build.
function botStub(): Plugin {
  const bots = new Set<string>();
  return {
    name: 'bot-stub',
    applyToEnvironment: (env) => env.name === 'client',
    // A generated file is never inlined as a data URL, so the asset check below sees it.
    config: () => ({ build: { assetsInlineLimit: (file) => (file.endsWith('.gen.ts') ? false : undefined) } }),
    async transform(code, id) {
      const file = id.split('?')[0];
      if (!file.startsWith(`${games}/`)) return;
      for (const { start, end, moduleRequest } of parseSync(file, code).module.dynamicImports.toReversed()) {
        const bot = await this.resolve(code.slice(moduleRequest.start + 1, moduleRequest.end - 1), file);
        if (bot) bots.add(bot.id.split('?')[0]);
        code = `${code.slice(0, start)}Promise.reject(new Error('no bot code in the browser'))${code.slice(end)}`;
      }
      return code;
    },
    generateBundle(_, bundle) {
      for (const output of Object.values(bundle)) {
        const ids = output.type === 'chunk' ? output.moduleIds : output.originalFileNames;
        const leak = ids.map((id) => id.split('?')[0]).find((id) => bots.has(id) || id.endsWith('.gen.ts'));
        if (leak) this.error(`${leak} reached the web build in ${output.fileName}`);
      }
    },
  };
}

export default defineConfig({ plugins: [cloudflare(), botStub()] });
