# Building a Game on Eigen

This is the guide for writing a game **on** the Eigen engine. Its companion,
[`architecture.md`](./architecture.md), describes the engine itself; read this
one to ship a game.

The promise of the engine is a sharp division of labour: **you write pure game
rules; the engine owns everything else** — persistence, serialization, timing,
sockets, reconnection, ratings, bots, auth, history, and the API. You never
touch a database, a Durable Object, a migration, or a socket. You implement one
small, precisely-typed contract, wire it into a Worker, and deploy.

Everything you write lives behind one interface, `GameModule`, from the
`@eigeninteractive/rules` package. That package is pure types plus two tiny helpers, and it
has zero engine dependencies — you can read it top to bottom in ten minutes.

---

## 1. The mental model

An Eigen game is a **sequence of server-authoritative transitions**. The engine
holds an opaque blob of *your* state per game; each move calls one of your hooks
to produce the next blob, plus who may move next and (eventually) the outcome.
Four facts define the shape of everything you write:

1. **Your state is pure and opaque.** The engine stores and versions it but never
   looks inside. It holds *only* your game payload (board, deck, scores, fog) —
   never whose-turn or winner metadata; those are engine-owned. Your hooks are
   pure functions from `(state, input)` to a new state.

2. **The engine is authoritative; the client is a proposer.** A player's move is
   validated by *your* `applyAction` on the server. If it's illegal you throw;
   the engine rejects it. The client also runs a Dart twin of your rules for
   optimistic preview, but the server's answer is the truth.

3. **You never branch on version.** Rules are organized one unit per
   `schema_version`. The engine resolves a game's version once and calls the
   right unit's hooks — your hook bodies only ever see their own version's shapes.

4. **Determinism is required.** State must be a pure function of `(seed, ordered
   moves)`. Any randomness comes from an engine-provided, replay-stable `rng`.
   This is what makes history, reconnection, and preview all work — so no
   `Date.now()`, no `Math.random()`, no external reads inside a hook.

---

## 2. What you implement: `GameModule` and `GameRules`

A `GameModule` is just a map from `schema_version` to a `GameRules` unit:

```ts
import type { GameModule } from "@eigeninteractive/rules";
import { rulesV1 } from "./v1.js";

export const gameModule: GameModule = {
  versions: { 1: rulesV1 },
};
```

A `GameRules` unit is one version's **payload schemas + six hooks** (plus an
optional seventh for bots). The whole contract:

```ts
interface GameRules<TState, TAction, TConfig> {
  schemas: { state; action; config };                        // Standard Schema each

  initialState(args): Envelope<TState>;                      // seed a new game
  applyAction(args): Envelope<TState>;                       // a player's move
  applyLifecycle(args): Envelope<TState>;                    // timeout / forfeit
  computeObservation(args): ObservationSlice;                // per-seat view (fog)
  ratingPool(args): string | null;                           // rated? which pool?
  botSeatable(args): boolean;                                // may this bot sit?

  botActions?: Record<string, BotAction<TAction, TConfig>>;  // in-engine bot brains
}
```

Author each unit as a class `implements GameRules<State, Action, Config>` (or a
literal typed `: GameRules<…>`) so you get full type-checking, then register it
in the `versions` map. That's it — no base class to extend, no lifecycle to
manage.

> **The other half of your game is Dart.** Every game also ships a same-keyed
> Dart `GameModule` in the client repo — the payload codec, `isValidAction`,
> `previewAction`, the board rendering, and display-only twins of `ratingPool`
> and `botSeatable`. That contract is documented in **`docs/client_reference.md`
> in the `eigen-flutter` repo** (Part II); this guide covers the authoritative
> TypeScript half. The two are kept honest by shared fixtures (§11).

---

## 3. Schemas & payload types — schema-first

Every payload that crosses the JSON boundary (`state`, `action`, `config`) is
declared as a **Standard Schema** — bring Zod, Valibot, ArkType, anything that
implements the spec. The engine parses each payload with your schema *before*
your hook sees it, and re-validates the state your hook returns before
committing. So your hook bodies never touch unvalidated JSON.

Derive your TypeScript types from the schemas, and follow two rules:

- **Use `type` aliases via `z.infer`, not `interface`s.** The engine's
  `JsonObject` constraint needs the implicit index signature that a `type` gets
  and an `interface` doesn't.
- **Keep schemas transform-free.** What parses is what persists — don't reshape
  in the schema. And schemas must validate **synchronously** (the engine rejects
  an async schema as a game bug; every mainstream library is sync unless you opt
  into async refinements).

```ts
import { z } from "zod";

const moveSchema   = z.enum(["rock", "paper", "scissors"]);
const actionSchema = z.object({ move: moveSchema });
const configSchema = z.object({ targetWins: z.int().min(1).max(10) });
const stateSchema  = z.object({ /* your board */ });

type Action = z.infer<typeof actionSchema>;
type Config = z.infer<typeof configSchema>;
type State  = z.infer<typeof stateSchema>;
```

---

## 4. The hooks, in detail

Everything returns an **`Envelope<State>`**: the new `state`, the
`pending_players` who may act next (empty ⇒ game over), an optional `outcome`
(present **only** when the game ends), and an optional `turn_seconds` override
for this one action.

### `initialState({ config, rng, playerCount }) → Envelope`

The starting position. Draw any setup randomness (shuffle, first player) from
`rng`. Set `pending_players` to whoever moves first.

### `applyAction({ state, pending, data, playerIndex, config, rng }) → Envelope`

A player's move. **The engine has already confirmed it is this seat's turn at the
expected version** — do not re-check turn order. Validate move *legality* only;
if it fails, `throw new IllegalMoveError("…")` and the engine renders it as the
caller's error. Any *other* throw is treated as a game bug (a server 500). Return
the next envelope: advance the state, set the next `pending_players`, and include
`outcome` if this move ended the game.

### `applyLifecycle({ state, pending, type, data, rng }) → Envelope`

Resolve an out-of-rules event. Unlike `applyAction` it can never be "illegal" —
it always resolves. Three triggers:

- **`timeout`** — the seats in `pending` ran out of time. Resolve the whole set
  in one envelope (you decide the consequence — often a loss for the idle seat,
  or a draw if everyone stalled).
- **`forfeit`** — a voluntary resign; the seat is in `data.player_index`.
- **`auto_forfeit`** — the engine-driven variant (an account was deleted). Same
  shape as forfeit; you *may* choose a gentler consequence (e.g. a draw rather
  than a loss) since the seat didn't choose to quit.

### `computeObservation({ state, pending, playerIndex, cause, isReplay, … }) → ObservationSlice`

Project the state into **one seat's view** — this is where hidden information
lives. Return `{ data, pending_players }`:

- `data` is exactly what this seat may see. Strip anything hidden (opponents'
  hands, face-down cards, un-revealed simultaneous commits).
- `pending_players` may be *narrowed* from the true set to avoid leaking
  information (e.g. hiding that an opponent has secretly moved) — but it must
  stay truthful about the seat *itself*, and the engine enforces that.
- `playerIndex` is `null` for a public viewer (only ever with `isReplay: true` —
  a finished public game), where you can reveal everything.
- `cause` tells the seat *what just happened* (see §7). `isReplay` is true only
  for finished-game replay, where hidden-info games may reveal opponent state.

For a **perfect-information game**, use the shipped `passthroughObservation`
helper — every seat sees the full state and the true pending set.

**This hook silently sets your simultaneous-move policy** — see §6.

### `ratingPool({ access, turnSeconds, budgetSeconds, config, … }) → string | null`

Decide whether — and in which pool — a game with these settings is rated. Return
a pool name (`"standard"`, `"rapid"`, …) or `null` for unrated. The engine
computes `canBeRated = pool !== null && !guest` and validates the client's
concrete `rated` flag against it. (The Dart twin computes the same value so the
create dialog can gate the Rated/Casual toggle.)

### `botSeatable({ gameConfig, botConfig }) → boolean`

Whether a bot's declared capabilities support this game config. Return `true` to
allow the seating.

---

## 5. A complete example — Rock-Paper-Scissors

RPS is the engine's *hardest-case-first* example: simultaneous commitment with
hidden information. Both seats are pending each round; a commit is stored in the
state but hidden from the opponent by `computeObservation`. Here is the whole
game (see `examples/rps/src/rules/v1.ts` for the file with comments):

```ts
class RpsRulesV1 implements GameRules<State, Action, Config> {
  readonly schemas = { state: stateSchema, action: actionSchema, config: configSchema };

  initialState(): Envelope<State> {
    return { state: { round: 1, wins: [0, 0], commits: [null, null], lastRound: null },
             pending_players: [0, 1] };
  }

  applyAction({ state, data, playerIndex }: ApplyActionArgs<State, Action, Config>): Envelope<State> {
    const seat = playerIndex as 0 | 1;
    const other = (1 - seat) as 0 | 1;
    const otherMove = state.commits[other];

    if (otherMove === null) {
      // First commit: record it, wait for the opponent.
      const commits: State["commits"] = [null, null];
      commits[seat] = data.move;
      return { state: { ...state, commits }, pending_players: [other] };
    }
    // Second commit: resolve the round (and maybe the match).
    const moves = seat === 0 ? [data.move, otherMove] : [otherMove, data.move];
    const winner = beats(moves[0], moves[1]) ? 0 : beats(moves[1], moves[0]) ? 1 : null;
    const wins = [...state.wins]; if (winner !== null) wins[winner] += 1;

    if (winner !== null && wins[winner] >= config.targetWins) {
      return { state: { ...state, wins, commits: [null, null], lastRound: { moves, winner } },
               pending_players: [], outcome: matchOutcome(winner) };
    }
    return { state: { round: state.round + 1, wins, commits: [null, null], lastRound: { moves, winner } },
             pending_players: [0, 1] };
  }

  computeObservation({ state, pending, playerIndex, isReplay }: ComputeObservationArgs<…>): ObservationSlice {
    if (isReplay || playerIndex === null) {
      return { data: { round: state.round, wins: state.wins, lastRound: state.lastRound, commits: state.commits },
               pending_players: pending };
    }
    const seat = playerIndex as 0 | 1;
    // Two deliberate omissions that ARE the game:
    //  - the opponent's commit is hidden (only your own move comes back);
    //  - the opponent's pending status is masked (you see only your own).
    return { data: { round: state.round, wins: state.wins, lastRound: state.lastRound, yourMove: state.commits[seat] },
             pending_players: pending.filter((s) => s === seat) };
  }

  ratingPool({ access }: RatingPoolArgs<Config>): string | null {
    return access === "public" ? "standard" : null;
  }
  botSeatable(): boolean { return true; }
}
```

Notice what the engine did for you: RPS never mentions turns, deadlines,
sockets, versions, persistence, or ratings. It stores commits in its own state
and hides them in `computeObservation` — and that single choice makes both the
hidden information *and* the simultaneous-move correctness fall out for free (§6).

---

## 6. Hidden information & the same-view rule

Simultaneous moves are the classic source of turn-based race bugs. Eigen resolves
them with a rule that needs **zero game code**, driven entirely by what your
`computeObservation` reveals:

> A stale-version action (one computed against an older version) is accepted **if
> and only if** the acting seat's projected observation is byte-identical between
> the version it expected and the current version. Otherwise it's rejected with
> `board_updated` and the client resyncs.

Work through RPS. Both players commit "simultaneously":

- Player 0 commits. The state changes (version bumps), but because
  `computeObservation` **hides player 1's commit and masks player 1's pending
  status**, *player 1's projected view is unchanged*. So player 1's in-flight
  commit — computed against the older version — still lands. Order doesn't
  matter.
- When the *second* commit resolves the round, the reveal (`lastRound`, the new
  `wins`) changes *every* seat's view — so any submission still computed against
  the pre-resolution round is correctly rejected.

You never wrote a lock, a "both players ready" check, or a retry. You chose what
each seat sees, and the acceptance policy followed. A perfect-information game
using `passthroughObservation` gets the *strict* policy automatically: any
opponent move changes everyone's view, so no stale submission survives.

Two invariants to rely on: versions stay strictly serial (the rule governs
*acceptance*, never ordering — every accepted move is still the next version),
and a seat's projection must stay truthful about itself (the engine enforces it).

---

## 7. Transitions & animation — the `cause`

Pure frame-diffing can't always recover *what happened* (identical footprints,
hidden moves, composite resolutions). So `computeObservation` receives a
`cause` — the action that produced the state being projected (`{ kind: "game",
data, playerIndex }`, a `lifecycle`, or `null` for the initial frame).

To let a client animate, embed whatever cues a seat is *permitted* to see into
that seat's `data` (e.g. a `lastMove` field, or RPS's `lastRound` reveal).
Because the embedding happens inside `computeObservation`, visibility stays
game-controlled. Cues describe a *transition*: a client renders them as animation
when it holds the predecessor frame, and as static "last move" info otherwise.

---

## 8. Timing

You mostly get timing for free — a game is created in one of three modes (per-turn
budget, chess-clock bank + optional increment, or untimed), the client picks the
values, and the engine enforces the deadline with a durable per-game alarm. Your
only timing touchpoints:

- **`applyLifecycle` on `timeout`** — decide the consequence when a seat's clock
  runs out (§4).
- **The envelope's `turn_seconds`** — override the deadline for *one* action
  only (e.g. a longer window for a special phase), without touching any player's
  bank. Omit it to use the game's configured timing.

If a game seats a bot, it **must** be timed — the deadline is the backstop for a
bot that never moves. The engine enforces this at seating; your `botSeatable`
doesn't need to.

---

## 9. Bots

A bot is a registry row (an operator inserts it) whose `type` decides how it
moves. The one you write in your game module is the **`engine`** bot — a brain
that runs *inside* the engine, no external service:

```ts
readonly botActions: Record<string, BotAction<Action, Config>> = {
  // keyed by the bot's registry `username`
  "rps-random": ({ rng }) => {
    const moves: Move[] = ["rock", "paper", "scissors"];
    return { move: moves[Math.floor(rng.next() * moves.length)] };
  },
};
```

When a seated engine bot is due, the engine resolves its row → `username` → this
function, runs it post-commit, and self-applies the returned move as that seat's
action — validated against `schemas.action` exactly like a human's (an illegal
bot move fails that seat's turn and the deadline backstops it; it can't corrupt
the game). The brain sees only its seat's observation — the same fog a human
gets, so a bot can't read hidden state.

Notes:
- **Several bots, one brain.** Personalities that share behaviour point their
  usernames at the same function and differ by their per-row `botConfig`
  (difficulty, style). Distinct behaviour is a distinct entry.
- **`rng` is deterministic** per (game, version, seat) for reproducible tests,
  but replay uses the *recorded* move, so the brain needn't be pure.
- **External and local bots** are engine concepts, not things you code in the
  game module: `external` bots are hosted elsewhere and woken over a signed
  webhook; `local` bots are reserved for future offline play. You only write
  `engine` brains here.

---

## 10. Wiring it into a Worker

Two small pieces of glue, both from `@eigeninteractive/server`:

```ts
// src/index.ts
import { BaseGameDO, createEngine } from "@eigeninteractive/server";
import { gameModule } from "./rules/index.js";

// 1. Bind the game's Durable Object to your game module + D1.
export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;
  protected d1(env: Env) { return env.MY_D1; }
}

// 2. Export the Worker.
export default createEngine({
  gameModule,
  appName: "Rock Paper Scissors",
  d1:     (env: Env) => env.MY_D1,
  gameDO: (env: Env) => env.GAME_DO,
  // Optional feature blocks — omit to leave a feature off:
  // deepLink:  { android: {...}, apple: {...} },
  // avatars:   { bucket: (env) => env.AVATARS },
  // site:      { tagline: "…", primaryColor: "#…", operator: {…} },
  // lifecycle: { guestMaxAgeMs: … },
});
```

You pass **accessors**, not binding names — the engine reads each binding off
*your* `Env`, so you can call them whatever you like in `wrangler.jsonc`. The
config's type parameters infer from these accessors.

Your `wrangler.jsonc` declares: the `GameDO` Durable Object (SQLite storage, via
the `exports` field), your D1 database, a daily `cron` trigger (the lifecycle
backstop), `nodejs_compat`, and — if you use them — an R2 bucket for avatars and
a `public/` assets directory. Set `FIREBASE_PROJECT_ID` (required for auth); add
the `FIREBASE_*` service-account trio to enable push, and `BOT_SIGNING_SECRET`
to enable external bots.

You do **not** write D1 migrations — the engine owns its schema and ships the
migrations; you apply them with `wrangler d1 migrations apply` at deploy. The
per-game DO schema self-applies. (If you need your own app-specific tables, that
is a *separate* D1 database with its own migrations — never the engine's.)

### Your game's website (optional)

Point a domain at your Worker and the `site` block gives you the whole public web
surface — no templates to copy, no routes to register:

| Route | What it is |
|---|---|
| `GET /` | Landing page: name, tagline, screenshots, store buttons |
| `GET /terms`, `/privacy`, `/delete-account` | The legal documents |
| `GET /sitemap.xml`, `GET /robots.txt` | Crawler directives |
| `GET /site.webmanifest` | Web app manifest |

```ts
site: {
  tagline: "A hidden-information battle of wits for two players.",
  primaryColor: "#1a237e",
  screenshots: ["1.png", "2.png"],   // under public/screenshots/
  operator: {
    name: "Your Company Ltd",
    jurisdiction: "India",
    contactEmail: "hello@example.com",
    effectiveDate: "1 July 2026",
  },
},
```

The absolute URLs in canonical links, OG tags and the sitemap are built from the
**request origin** — no domain to configure. So that this stays the one canonical
host, disable the `workers.dev` route in production; the custom domain is then
the only host the worker answers on. Store buttons come from your `deepLink`
block, so store URLs are configured once. The landing page emits
`SoftwareApplication` JSON-LD with `applicationCategory: "GameApplication"`.

**Assets: your Flutter app already made them.** The engine never generates
images, but it doesn't ask you to draw any either — its default paths are
exactly the filenames `flutter_launcher_icons` emits into the app's `web/`
directory, all derived from the same `assets/icon/icon.png` the app icon uses.
Copy that output into `public/`:

```
public/
  favicon.png                      # web/favicon.png
  og-image.png                     # web/og-image.png (1200×630, override with `ogImage`)
  icons/Icon-192.png               # web/icons/…
  icons/Icon-512.png
  icons/Icon-maskable-192.png
  icons/Icon-maskable-512.png
  screenshots/                     # optional, whatever you list in `screenshots`
```

`og-image.png` is the only hand-made file, and `client_reference.md` §22 already
asks for it for the app's own share card. Nothing here needs authoring twice.

> **Android App Links must be scoped.** Because these pages sit on the same host
> as the app's deep links (`/join/:code`, `/game/:id`), the app's
> `<intent-filter>` needs an `android:pathPrefix` for each of `/join` and
> `/game` — `assetlinks.json` verifies the whole host, so without the prefixes
> Android claims `/terms` too and hands it to a router that has no such route.
> iOS is already scoped by the generated AASA.

**Legal documents.** All three default to generic templates the engine ships.
They take your `operator` block as typed props — there are no placeholders to
fill in and nothing to keep in sync. They describe **only what the engine itself
collects**: accounts, display names, optional avatars, game history, ratings,
friend connections, push tokens and crash diagnostics.

> **Read them before you publish.** They are a starting template, not legal
> advice, and you are the one on the hook for what they say. If you add
> analytics, advertising, payments, or any other processing, you must edit them.
> Two lines in particular assume things about your app: the privacy policy's
> "Diagnostics" bullet assumes crash reporting, and the delete-account steps
> describe the reference Flutter shell's Settings screen.

To supply your own prose, pass an HTML **fragment** — body content only, since
the engine supplies the shell, styling and footer:

```jsonc
// wrangler.jsonc — lets you import .html files as strings
"rules": [{ "type": "Text", "globs": ["**/*.html"], "fallthrough": true }]
```

```ts
import terms from "./legal/terms.html";
// …
site: { /* … */ legal: { terms } },
```

Your fragment is inserted as-is, so write your own values into it directly.

**Overriding a whole page takes no config at all.** Cloudflare serves a matching
static asset *before* invoking your Worker, and the default `html_handling`
resolves `/terms` to `public/terms.html`. So shipping the file replaces the
generated page — same format as the config path. The flip side: never add a file
under `public/` whose path shadows a route you did not mean to replace
(`public/index.html` will silently replace your landing page).

### Rate limiting (optional)

The engine per-user rate-limits the write endpoints that are cheap to spam —
game creation, friend requests, user search, and avatar uploads — using the
Workers [`ratelimit`](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
binding. It's **off until you bind it, and needs no code**: the engine resolves
each limiter by a fixed `EIGEN_RATE_LIMIT_*` binding name, so declaring the block
below in `wrangler.jsonc` is the entire setup. A limiter you don't bind is simply
unlimited.

```jsonc
// wrangler.jsonc — recommended starting values
"ratelimits": [
  { "name": "EIGEN_RATE_LIMIT_AVATAR_UPLOAD",  "namespace_id": "1001", "simple": { "limit": 5,  "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_GAME_CREATE",    "namespace_id": "1002", "simple": { "limit": 10, "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_FRIEND_REQUEST", "namespace_id": "1003", "simple": { "limit": 20, "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_USER_SEARCH",    "namespace_id": "1004", "simple": { "limit": 20, "period": 10 } }
]
```

The **`name`** must match exactly (that's how the engine finds the binding); the
**`limit`/`period`** are yours to tune — the engine never reads them, the
platform enforces them, and `period` may only be `10` or `60`. Each
**`namespace_id`** is a positive integer that **must be unique within your
Cloudflare account**: ids are account-scoped, so reusing one across two Workers
makes them share counters. A limited caller gets `429` with `code:
"rate_limited"` and a `Retry-After` header. The binding is per-colo and
eventually consistent — an abuse dampener, not a hard quota.

---

## 11. Testing your game

Two layers, both fast and offline.

### Twin fixtures (the drift net)

Your rules exist twice — TS here, Dart in the client repo. **Shared JSON
fixtures** record expected behaviour once and run against both, so a divergence
fails a test on both sides. A fixture file is a list of cases:

```json
{
  "schemaVersion": 1,
  "cases": [
    {
      "kind": "action",
      "name": "first commit of a round is recorded and hidden",
      "config": { "targetWins": 1 },
      "state":  { "round": 1, "wins": [0,0], "commits": [null,null], "lastRound": null },
      "pending": [0, 1],
      "playerIndex": 0,
      "action": { "move": "rock" },
      "expected": {
        "valid": true,
        "state": { "round": 1, "wins": [0,0], "commits": ["rock",null], "lastRound": null },
        "pending": [1],
        "outcome": null,
        "observation": { "round": 1, "wins": [0,0], "lastRound": null, "yourMove": "rock" }
      }
    }
  ]
}
```

`kind` can be `action` (drives `applyAction` + `computeObservation`),
`ratingPool`, or `botSeatable`. Wire them into a test with one line from the
testkit:

```ts
import { twinFixtureTests } from "@eigeninteractive/testkit";
import { gameModule } from "../../src/rules/index.js";

twinFixtureTests(gameModule, new URL("../../src/rules/fixtures/", import.meta.url));
```

Write fixtures for the interesting states — especially hidden-info reveals and
`computeObservation` masking — because those are exactly where the TS and Dart
twins drift. Copy the observation your hook *should* produce for each seat into
`expected.observation`; the runner checks it byte-for-byte.

### Integration tests

Drive the real Worker (routes + DO + D1) with `@cloudflare/vitest-pool-workers`,
using `@eigeninteractive/server/testing` to mint local test tokens. The engine's own suites
cover the plumbing (lobby, sockets, timing, finish, ratings, purge); your job is
to test *your game's* behaviour end-to-end where it matters — a full match, a
timeout resolution, a bot game.

---

## 12. CI for a game repo

Everything in §11 runs offline and needs no Cloudflare account, so a game's CI is
just those commands on a runner. There are no secrets to inject: the Workers
tests boot the real `workerd` with local D1/R2/DO simulation, and
`@eigeninteractive/server/testing` mints the tokens, so nothing reaches the network.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4          # reads `packageManager`, NOT `devEngines`
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm exec biome ci .           # or your linter of choice
      - run: pnpm -r build                  # engine packages resolve via exports → dist
      - run: pnpm -r typecheck
      - run: pnpm -r test                   # twin fixtures + integration
```

`pnpm -r build` before `typecheck` is not optional if your game lives in a
workspace beside the engine packages: they resolve through their `exports` field
to `dist/`, so an unbuilt `@eigeninteractive/server` fails to type-check its consumers.

**Do not deploy from CI.** `wrangler d1 migrations apply --remote` mutates a real
database, and a deploy is the one action in this system that isn't reversible by
re-running a job. Keep it a deliberate, credentialed `pnpm deploy` from a
machine — or, if you do want push-button deploys, connect the repo to Cloudflare
**Workers Builds** so the deploy is owned by Cloudflare's side rather than by a
long-lived API token sitting in GitHub secrets.

### The half your CI cannot see

Your rules exist twice, in two repos, and **the fixture JSON is duplicated —
there is no sharing mechanism.** The consequence is easy to get wrong:

> Editing a fixture here makes *this* repo's CI green while the client repo
> still holds the old copy. Nothing fails until the client repo's CI next runs —
> possibly days later, on someone else's PR.

So a rules change is a **two-repo change**, and the fixture edit is the part that
must land in both. Copy the same `v<N>/*.json` files into the client repo's
fixture root in the same change. Both runners read `schemaVersion` from inside
the file and expect a `v<N>/` directory layout, so the files are byte-identical
between repos — which is exactly what makes a stale copy invisible.

If the two repos are ever built together (a monorepo, or a CI job that checks out
both as siblings the way a Flutter app's workflow checks out the engine), a
`diff -r` between the two fixture roots is the cheapest possible guard.

---

## 13. Evolving your game — versions

When rules or payload shapes change **incompatibly**, do not edit a shipped
unit's semantics — that would break games (and replays) already running under it.
Instead:

1. Copy `v1.ts` to `v2.ts`, importing whatever didn't change.
2. Make the change in `v2`.
3. Register it: `versions: { 1: rulesV1, 2: rulesV2 }`.

New games are created at the latest version your build ships; existing games keep
running against their own version's unit until they drain, at which point you can
retire it by deleting the entry. The engine handles all dispatch — your hooks
never branch on version, and the schema gate makes an old client politely refuse
a newer game rather than mis-parsing it. Compatible tweaks (a bug fix that
doesn't change stored shapes or recorded behaviour) can edit the unit in place;
update the fixtures alongside.

---

## 14. What the engine owns (and you never touch)

To keep the boundary crisp, here is everything you get for free and must not
reimplement:

- **Persistence & serialization** — the per-game Durable Object, its SQLite, the
  input gate, versioning, and idempotent retries.
- **The waiting room** — create, join (by id or code), leave, cancel, add-bot,
  start; short codes; guest and friends-access gating.
- **Sockets & reconnection** — one socket per game, pre-game roster snapshots,
  versioned frames, gap recovery by range fetch.
- **Timing** — deadlines, the chess-clock bank, the grace window, the durable
  alarm.
- **Ratings** — OpenSkill, the concurrency-safe CAS, pools, history (you only
  choose the pool via `ratingPool`).
- **Identity & auth** — Firebase token verification, user provisioning, guests,
  account deletion.
- **History & replay** — the immutable transition log, compaction, and the replay
  path (your `computeObservation` is reused to project it).
- **Bots infrastructure**, **push**, **deep links**, **avatars**, and the whole
  **HTTP/OpenAPI surface**.

Your entire job is the pure rules in `@eigeninteractive/rules` plus the ~15-line Worker glue.
If you find yourself reaching for a database, a socket, a clock, or a lock inside
a hook — stop; the engine already did it, and doing it in a hook would break
determinism.

---

## 15. Recipes — common game shapes

The whole game is expressed through `pending_players` and what
`computeObservation` reveals. A few canonical shapes:

**Sequential (perfect information)** — checkers, Connect Four. One seat pending
at a time; each move hands the turn to the next seat. Use
`passthroughObservation` (everyone sees everything). The same-view rule is
automatically strict — no stale move survives an opponent's turn.

```ts
applyAction({ state, playerIndex, data }) {
  const next = applyMove(state, playerIndex, data);
  return next.won
    ? { state: next, pending_players: [], outcome: win(playerIndex) }
    : { state: next, pending_players: [(playerIndex + 1) % playerCount] };
}
computeObservation: passthroughObservation,
```

**Simultaneous (hidden commitment)** — RPS, blind bidding. *All* actors pending
each round; store each commit in the state and hide the opponents' commits in
`computeObservation`, also masking their pending status so a hidden commit
doesn't change anyone else's view (that's what lets both submissions land in
either order — §6). Resolve when the last commit arrives.

**Team games** — set `team_index` on outcome entries to the team, not the seat,
so OpenSkill rates teammates together. `placement` is the team's finish.

**Elimination / multiplayer** — shrink `pending_players` as seats bust out; give
an eliminated seat `result: "eliminated"` with its `placement`. The game ends
when `pending_players` empties; the final `outcome` ranks everyone by placement.

**Reveal for animation** — carry a "what just happened" field (RPS's `lastRound`)
in the projected `data` so clients can animate the transition. Decide per seat
what that reveal shows using `cause` and `playerIndex` (§7).

**Phased turns / variable clocks** — a phase that needs longer returns
`turn_seconds: N` on its envelope to widen just that action's deadline, leaving
every player's bank untouched.

---

## 16. Reference — the Envelope, determinism, and errors

### The Envelope

Every hook returns `Envelope<State>`:

| Field | Meaning |
|---|---|
| `state` | The new pure game payload — validated against your `state` schema before commit. Never carries whose-turn or winner metadata. |
| `pending_players` | 0-based seats that may act next. **Empty ⇒ the game is over** (with `outcome`). |
| `outcome?` | Present **only** on the ending transition: one `OutcomeEntry` per seat (`result`, `placement`, `team_index`, optional `score`). |
| `turn_seconds?` | Override the deadline for *this action only*; omit for the game's configured timing. |

### Determinism — the RNG contract

State must be a pure function of `(base seed, ordered action log)`. The engine
gives each transition a seeded `rng` (`rng.next()` → `[0, 1)`), derived from the
game's stored seed and the committing version, so replaying a transition
reproduces the identical sequence. The rules:

- **Draw only from `args.rng`** — never `Math.random()`, `Date.now()`,
  `crypto`, or any external read inside a hook.
- **Draw in deterministic code order** — the same number of draws in the same
  order every time, so a replay lines up.
- **Bot brains may be impure** — a bot's `rng` is deterministic too, but the
  *chosen move* is what gets logged; replay reads the recorded action and never
  re-runs the brain, so a brain that peeks at the clock only affects live play.

### Errors — what to throw

- `throw new IllegalMoveError("…")` from `applyAction` for a move that breaks the
  rules (a mis-tap, a buggy client). The engine renders it as the **caller's**
  error (a 400 `illegal_move`) — this is an *expected* outcome, not a fault.
- **Any other throw** from a hook is treated as a **game bug** and surfaces as a
  server 500. Don't use exceptions for control flow; return the right envelope
  instead.
- You never validate turn order, versions, seat ownership, or timing — the engine
  has already enforced all of it before your hook runs. Validate only move
  *legality*.

For how any of this works under the hood, read
[`architecture.md`](./architecture.md).
