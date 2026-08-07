# Example Game Worker

The authoritative game rules and Cloudflare Worker for an EigenInteractive game.

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

## `pnpm-workspace.yaml`

Two things live in that file, and both are pnpm's rather than yours. It is kept
free of comments because pnpm rewrites it in place, and because a YAML
formatter is free to move anything written there.

`allowBuilds` names the dependencies permitted to run install scripts. pnpm
refuses to run them unless the project asks, and fails the install outright
when one is skipped (`ERR_PNPM_IGNORED_BUILDS`). Two need theirs: `esbuild`
fetches its platform binary, and `workerd` is the runtime `vitest` and
`wrangler dev` execute against. npm runs install scripts by default and ignores
the file entirely, so the scaffold is correct under both.

`minimumReleaseAgeExclude` appears on its own. pnpm 11 will not install a
version published less than a day ago — a quarantine against a compromised
publish — and the engine packages are subject to it like any other dependency.
When a range can only be satisfied by a release younger than that, as `^0.3.0`
is on the day 0.3.0 ships, pnpm installs it anyway and records the exact
version it allowed. Each entry names one version, so the exemption expires with
it rather than opening the scope. Leave them, and commit them.

The one place the quarantine is silent is `pnpm create eigen-game`, where there
is no manifest to record an exemption in and an older scaffolder satisfies
`latest` perfectly well. Pass an exact version there on release day.
