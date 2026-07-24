# @eigen/server

The deployable half of the [Eigen engine](https://eigeninteractive.com) — a
server-authoritative engine for turn-based multiplayer games on Cloudflare
Workers.

One deployment is a single Worker that owns its own domain, database and
players. You write pure game rules; this package owns persistence, timing,
sockets, reconnection, ratings, bots, auth, history, the HTTP API and the
game's website.

```ts
import { BaseGameDO, createEngine } from "@eigen/server";
import { gameModule } from "./rules";

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

Ships the engine's D1 migrations under `migrations/` — point your
`migrations_dir` at `node_modules/@eigen/server/migrations` and apply them with
`wrangler d1 migrations apply`. You never author them.

## Documentation

Full documentation: **<https://eigeninteractive.com/docs/operate/configuration>**

- [Quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
- [API reference](https://eigeninteractive.com/docs/reference/typescript)
- [For agents: llms.txt](https://eigeninteractive.com/llms.txt)

## License

MIT © Eigen Interactive
