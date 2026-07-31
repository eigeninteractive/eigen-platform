# Example Game Worker

The authoritative game rules and Cloudflare Worker for an Eigen game.

## Develop

Install dependencies with `npm install` or `pnpm install`, then:

```sh
npm run cf-typegen
npm run contract
npm test
npm run dev
```

The `src/module/index.ts` default export is the game contract. Add fixtures
under `src/module/fixtures/`; `npm run contract` emits the language-neutral
`game-contract.json` consumed by the Flutter payload generator.

During rules development, keep `npm run test:watch` running. After changing a
schema or fixture, run `npm run contract`; CI can use
`npm run contract:check` to reject a stale committed artifact.

## Configure and deploy

`FIREBASE_PROJECT_ID` and `WEB_APP_ORIGIN` under `wrangler.jsonc` → `vars` are
the Worker's non-secret environment variables in local development and
production. Copy `.dev.vars.example` to `.dev.vars`, then fill
`FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` from the same Firebase
project's service-account JSON. These credentials are required for FCM and
complete Firebase account deletion; `.dev.vars` is git-ignored.

For deployment, store both values as Wrangler secrets:

```sh
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
```

`WEB_APP_ORIGIN` is the exact Flutter web origin the engine automatically
allows to make browser API and WebSocket requests, and the trusted base for
absolute notification links. The scaffolded `http://localhost:7357` value
matches the documented Flutter command; change it to the canonical HTTPS
origin before production. Configure `clientOrigins` in `createEngine` only
when you need multiple or non-standard browser origins.

The combined scaffold builds Flutter directly into `public/`. Static assets
bypass Worker execution; `/api/*`, `/join/*`, `/game/*`, `/download`, legal,
and verification paths run Worker-first. `npm run deploy` applies the engine
migrations before deploying the Worker and whatever is already in `public/`.
