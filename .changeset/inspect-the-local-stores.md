---
"@eigeninteractive/testkit": patch
---

New `eigen-inspect` command, for reading a Worker's local `.wrangler` state from the terminal while you develop a game.

A game's truth is split across two stores on purpose. D1 is the index: discovery, history, ratings, identity. The game's own Durable Object is the session: the authoritative status, the roster, and the append-only transition log. That split is what makes the engine's read paths cheap, and it is also why a question like "the lobby filled, so why is nothing happening" cannot be answered by looking at one table. The D1 `games` row is a fire-and-forget display mirror, so it can lag; the DO is the only authority.

`eigen-inspect game <id|code|prefix>` joins both, decodes every JSON column, prints the transition log as a timeline, and ends with the sentence you actually wanted:

```
Diagnosis     ready and not started: 2/2 seats filled. Nothing happens until the
              CREATOR calls POST /api/engine/games/{id}/start. A start is explicit
              and creator-only; filling the lobby does not start a game.
```

When the two stores disagree it says so as `Mirror drift`, naming the DO as authoritative, so a lost mirror write reads as a lost mirror write rather than as a mystery. A finished game with surviving `outbox` rows is called out the same way, since that means the D1 finish apply has not landed and ratings are not published.

The other commands are `games` (the index), `do` (every local Durable Object mapped back to its game id, which the hashed filename cannot tell you), `players`, `tables`, and `sql` for anything unmodelled. `--game <ref>` points `tables` and `sql` at one game's Durable Object instead of D1; `--json` emits everything for a script or an agent.

This complements rather than replaces Wrangler's own local browser, which is `e` in `wrangler dev` (or `/cdn-cgi/explorer`) and is the better tool for generic table browsing. `eigen-inspect` is the one that knows what a game is, and it needs no dev server, browser, or account.

The reader is also exported as a library at `@eigeninteractive/testkit/local-state`, so a test or a script can assert against local state directly:

```ts
import { LocalStore } from "@eigeninteractive/testkit/local-state";

const store = LocalStore.open();
const game = store.game("ABC123");
expect(game?.meta?.status).toBe("active");
store.close();
```

Every database is opened read-only, so all of this is safe to run against a live `wrangler dev`. It reads them through Node's built-in `node:sqlite`, so it adds no dependency, needs no native build, and nothing new reaches your Worker's runtime dependencies. It needs Node 24, which the engine already requires.
