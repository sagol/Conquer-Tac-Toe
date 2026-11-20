# Conquer-Tac-Toe

Conquer-Tac-Toe is a two-player board game for the browser. It has five arenas: Classic tic-tac-toe, Gomoku (five in a row on boards up to 19×19), and Conquer, Chaos and Custom, played on a 3×3 board with rings of three sizes, where a ring can cover a smaller one. You play another person or one of five bots, from Pip for first games to Omega, which is close to unbeatable. Results count toward seasonal ratings, with one ladder for games between people and one for games against bots.

The game is being rebuilt from scratch on Cloudflare, and nothing is playable yet. The old Node, Python and Docker version is kept under the tag `v1-legacy`.

## Run it

You need Node.js 24 and pnpm at the version pinned in `package.json`.

```sh
pnpm install
pnpm dev
```

`pnpm dev` starts Vite with the Cloudflare plugin, which runs the Worker and a local D1 database in workerd on your machine.

Run `pnpm verify` before you commit. It type-checks the code, runs Biome, checks the code budgets, the dependency list and the import rules in `tools/budget.mjs`, then builds the app and checks the bundle sizes.

## Deploy it

One Worker serves both the app and the API. `wrangler.jsonc` defines two Cloudflare environments, staging at staging.gurudo.com and production at gurudo.com, each with its own D1 database. A build targets one environment through `CLOUDFLARE_ENV`, the D1 commands pick the environment from the same variable, and `wrangler deploy` deploys whatever the last build produced:

```sh
CLOUDFLARE_ENV=staging pnpm build
CLOUDFLARE_ENV=staging pnpm exec wrangler d1 migrations apply conquer-staging --remote
pnpm exec wrangler deploy --tag "$(git rev-parse HEAD)"
```

Production deploys from `main` through Workers Builds. Its build command is `pnpm verify && CLOUDFLARE_ENV=production pnpm build`, and its deploy command is `CLOUDFLARE_ENV=production pnpm exec wrangler d1 migrations apply conquer --remote && pnpm exec wrangler deploy`.

Both hostnames sit behind Cloudflare Access until launch.

Each environment needs its secrets, set once with `CLOUDFLARE_ENV=<env> pnpm exec wrangler secret put <NAME>`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` (the admin Access application), and on staging also `STAGING_AUD` (the Access application for the whole hostname). A deploy that lacks one fails. Locally none are needed: Google sign-in answers 503 without them, and dev login (`POST /api/auth/dev` with `{"name": "alice"}`) signs you in as `dev-alice` on localhost. Staging has dev login behind its Access application; production has none.

## License

MIT, see [LICENSE](LICENSE).
