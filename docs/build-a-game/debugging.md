---
sidebar_position: 10
title: Debugging a live game
description: How to look inside a running game's two stores, the D1 index and its own Durable Object, with eigen-inspect, Wrangler's local explorer, raw SQLite and Drizzle Studio.
---

# Debugging a live game

A game you are developing has state in two places, and knowing which one to
trust is most of debugging it.

- **D1 is the index.** One row per game, plus participants, users, bots,
  ratings and friendships. It answers "which games exist", so it backs
  discovery, history and profiles.
- **The game's Durable Object is the session.** One SQLite database per game,
  holding the authoritative status, the roster, and the append-only transition
  log. It answers "what is happening in this game".

The DO is the authority. Its D1 row is a **display mirror**, written after the
commit and off the response path, so a lost mirror write leaves D1 stale while
the game plays on correctly. [Storage](../how-it-works/storage.md) covers why
the split is shaped that way.

That is the whole reason a game-shaped reader exists: "the lobby filled and
nothing happened" is not a question either store answers alone.

## `eigen-inspect`

A scaffolded game ships it wired up. It reads the local `.wrangler` state
directly, so it needs no dev server, no browser and no Cloudflare account, and
every database is opened read-only, so it is safe to run while your Worker is
running.

```bash
cd server
pnpm inspect games                   # the index, newest first
pnpm inspect game ABC123             # one game, everywhere, with its timeline
pnpm inspect do                      # every local Durable Object, by game id
```

`game` takes a full id, a short code, or an id prefix. It is the one to reach
for:

```text
Game 14eabf11-df25-4337-b6e1-be2984c8f2a5  CHNTAE

D1 index      status=ready  access=private  rated=no  schema=v1
              seats 2-2  untimed  created 2h ago  updated 2h ago
config        {"target":10}
participants  0:inbox.seenu   1:dev.seenuk

Durable Object  8fede5b00a07…  .wrangler/state/v3/do/my-game-GameDO/8fede5b0….sqlite
DO meta       status=ready  seats 2-2  createdBy=nth6vOqG…  rngSeed=(unset, so no start has committed)
roster        0:inbox.seenu   1:dev.seenuk
alarm         none armed
commands      1 recorded

Timeline
  (no transitions: the game has not started, so there is no v0)

Diagnosis     ready and not started: 2/2 seats filled. Nothing happens until the
              CREATOR calls POST /api/engine/games/{id}/start. A start is explicit
              and creator-only; filling the lobby does not start a game.
```

Reading that top to bottom:

| Line | What it tells you |
|---|---|
| `D1 index` | What discovery and history will show. Absent means the create never landed. |
| `Durable Object` | Whether a session exists at all. A created-but-untouched lobby has none: the DO is created lazily by the first command or socket. |
| `DO meta` | The authoritative status. An unset `rngSeed` proves no start has committed, whatever D1 says. |
| `alarm` | The armed turn deadline. `none armed` is correct for an untimed game and a bug for a timed one mid-turn. |
| `Timeline` | Every committed version with its cause, state, pending seats and which seats hold a stored frame. `(compacted)` frames are normal on a finished game, which re-projects for replay. |
| `Diagnosis` | The next event the game is waiting for. |
| `Mirror drift` | Present only when the two stores disagree, naming the DO as authoritative. |

Two lines are worth recognising on sight. **`Mirror drift`** means a mirror
write was lost: the game is fine, the lists are stale.
**`outbox N UNAPPLIED finish row(s)`** on a finished game means the D1 finish
apply has not succeeded, so outcomes and ratings are not published yet.

The rest of the commands cover what the report does not model:

```bash
pnpm inspect players                              # local users and bots, by id
pnpm inspect tables --game ABC123                 # tables and row counts
pnpm inspect sql "select * from participants"     # ad-hoc, against D1
pnpm inspect sql "select * from transitions" --game ABC123   # against one game's DO
pnpm inspect game ABC123 --json                   # for a script or an agent
```

`--dir <path>` starts the search for `.wrangler/state` somewhere other than the
current directory; otherwise it walks up, so any directory inside your game
repository works.

### In a test

The same reader is a library, which is the honest way to assert on state a
test cannot reach through the API:

```ts
import { LocalStore } from "@eigeninteractive/testkit/local-state";

const store = LocalStore.open();
try {
  const game = store.game(gameId);
  expect(game?.meta?.status).toBe("active");
  expect(game?.transitions.at(-1)?.pending).toEqual([1]);
  expect(game?.diagnosis.mirrorDrift).toEqual([]);
} finally {
  store.close();
}
```

:::note[No install]

The reader uses Node's built-in `node:sqlite`, so it adds no dependency and
needs no native build. It comes with the testkit, which is already a
`devDependency` of your game, and nothing new reaches your Worker's runtime
dependencies. Node 24 or newer, which the engine already requires.

:::

## Wrangler's local explorer

For browsing tables rather than asking about a game, Wrangler has a first-party
UI over the same files. With `wrangler dev` running, press **`e`**, or open
`/cdn-cgi/explorer` on the dev server. It covers every local binding, D1 and
Durable Object storage included, and is the better tool for poking at a table
you do not have a query for yet.

## SQL, local and deployed

The binding name works as the database name, so nothing has to be configured:

```bash
wrangler d1 execute GAME_DB --local  --command "select id, status from games"
wrangler d1 execute GAME_DB --remote --command "select id, status from games"
```

`--remote` is how you inspect a **deployed** game's index; the Cloudflare
dashboard has a console over the same database.

A deployed game's **Durable Object** has no such console. Your options there are
`wrangler tail` for the logs the DO writes as it commits, and adding a read-only
method to your own `GameDO` subclass if you need more. Locally the session is a
file, which is why local debugging is worth the setup.

## The raw files

Everything above reads these, and there is no reason not to open them yourself.
Under your Worker directory:

```text
.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite   the index
.wrangler/state/v3/do/<worker>-GameDO/<doId>.sqlite              one game each
.wrangler/state/v3/do/<worker>-GameDO/metadata.sqlite            armed alarms
```

The Durable Object filename is the object's id, which is
`idFromName(gameId)` **hashed**, so it is not the game id and cannot be turned
back into one by computation. Miniflare records the name it was addressed by in
each database, and that row is the only local file-to-game map there is:

```bash
sqlite3 .wrangler/state/v3/do/my-game-GameDO/<doId>.sqlite \
  "select name from __miniflare_do_name"
```

`pnpm inspect do` prints that mapping for every game at once.

## Drizzle Studio

The engine's schemas are Drizzle, so a browsable UI over a local file is a
config away. Point `schema` at the store you want and `url` at the file:

```ts title="drizzle.studio.config.ts"
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  // For one game's session, use .../server/src/do/schema.ts and a DO file.
  schema: "node_modules/@eigeninteractive/server/src/d1/schema.ts",
  dbCredentials: { url: "file:.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite" },
});
```

```bash
pnpm exec drizzle-kit studio --config drizzle.studio.config.ts
```

:::warning[Install the driver outside your game's workspace]

Drizzle Studio needs a SQLite driver, `better-sqlite3` or `@libsql/client`, and
**both are optional peer dependencies of `drizzle-orm`**. Adding either one to
your game re-resolves `drizzle-orm`'s peer set for every package that imports
it, which changes the types your Worker compiles against. It is a real way to
break a build that was fine, and the failure looks nothing like its cause.

Install `drizzle-kit` and the driver in a scratch directory outside your
repository and run Studio from there, pointing `url` at an absolute path into
your `.wrangler` state. Nothing about your game needs to change.

:::

## What to check when

| Symptom | Where to look |
|---|---|
| A game will not start | `pnpm inspect game <id>`: read `DO meta` status and `Diagnosis`. A start is explicit and creator-only. |
| A game vanished from a list | The index. A private game is never in the public lobby; check `access` and `status`, then look for `Mirror drift`. |
| A turn never times out | `alarm`. No alarm and a non-null `deadline` on the newest transition is the bug; an untimed game arms nothing by design. |
| A finished game shows no ratings | `outbox`. Surviving rows mean the D1 apply has not landed. |
| A move was refused | `commands`, which records each `commandId` with the response that was replayed. |
| Seats look wrong | Compare `roster` (authoritative) against `participants` (mirror). |
