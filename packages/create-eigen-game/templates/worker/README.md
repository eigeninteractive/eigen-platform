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

Set `FIREBASE_PROJECT_ID` in `wrangler.jsonc`. Wrangler provisions the `GAME_DB`
D1 binding automatically; `npm run deploy` applies the engine migrations before
deploying the Worker.
