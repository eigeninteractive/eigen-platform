# @eigeninteractive/server

The deployable half of the [Eigen engine](https://eigeninteractive.com) — a
server-authoritative engine for turn-based multiplayer games on Cloudflare
Workers.

One deployment is a single Worker that owns its own domain, database and
players. You write pure game rules; this package owns persistence, timing,
sockets, reconnection, ratings, bots, auth, history, the HTTP API and the
game's website. Firebase Auth and FCM are one required deployment capability:
the Worker reads `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
`FIREBASE_PRIVATE_KEY` from its environment. Players still choose whether to
grant notification permission, and delivery remains best-effort.

```ts
import { BaseGameDO, createEngine } from "@eigeninteractive/server";
import gameModule from "./module/index.js";

export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;
  protected d1(env: Env) { return env.MY_D1; }
}

export default createEngine({
  gameModule,
  appName: "My Game",
  d1: (env: Env) => env.MY_D1,
  gameDO: (env: Env) => env.GAME_DO,
});
```

`WEB_APP_ORIGIN` is used automatically as the trusted cross-origin browser
client. Set `clientOrigins` only when a deployment needs multiple or
non-standard browser origins.

Ships the engine's D1 migrations under `migrations/` — point your
`migrations_dir` at `node_modules/@eigeninteractive/server/migrations` and apply them with
`wrangler d1 migrations apply`. You never author them.

## Documentation

Full documentation: **<https://eigeninteractive.com/docs/ship-it/configure>**

- [Quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
- [Worker API reference](https://eigeninteractive.com/docs/reference/typescript/server)
- [For agents: llms.txt](https://eigeninteractive.com/llms.txt)

## License

MIT © Eigen Interactive
