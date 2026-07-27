# Eigen Server

The **server half** of the Eigen engine — a whitelabel backend for turn-based
multiplayer games, running on Cloudflare Workers. Identity, lobbies, the
authoritative game loop, timing, ratings, social, bots, push and deep links are
all built in. A game plugs in as a single TypeScript `GameModule`.

The **client half** lives in the sibling [`eigen-flutter`](https://github.com/eigeninteractive/eigen-flutter)
repo — a Flutter package that talks to this Worker over a generated REST client
plus one WebSocket per game.

One game becomes one Worker: it composes `createEngine(...)` with its rules and
its bindings, and owns nothing else. `examples/rps` is the reference
implementation and the thing you actually run locally.

## Documentation

| Doc | What it is |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | **Start here.** How the server works, end to end — the request path, the Durable Object, D1, timing, ratings, and §17 for deployment and operations. |
| [`docs/building_a_game.md`](docs/building_a_game.md) | How to build a game on the engine: the TypeScript rules contract, hook by hook, with recipes. |
| [`docs/todo.md`](docs/todo.md) | The single forward-looking tracker, covering **both** repos. |
| `doc/client_reference.md` in `eigen-flutter` | The client: transport, generated payload types and rules bases, the app shell, shipping an app. |

## Layout

```
eigen-server/
├── packages/
│   ├── rules/        # the GameRules contract — the types a game implements
│   ├── kernel/       # the pure, platform-free game loop (commit, timing, replay)
│   ├── server/       # the Worker: routes, auth, the GameDO, D1 schema + migrations
│   ├── testkit/      # twin-fixture runner + contract emitter
│   └── create-eigen-game/ # combined Worker/Flutter project scaffolder
├── examples/rps/     # the reference Worker — rock-paper-scissors
└── docs/
```

`kernel` is deliberately platform-free: it knows nothing about Workers, D1 or
Durable Objects, which is what makes the game loop testable in isolation and
replayable years later.

## Scaffold a game

After the packages are published, a game implementor starts with:

```bash
pnpm create eigen-game my-game
# or: npm create eigen-game@latest my-game
```

The command composes the canonical C3-style Worker template with
`flutter create --empty`, installs both halves, emits `game-contract.json`, and
generates the initial Dart payload types and rules base. It creates one combined
repository; teams using separate repositories can consume the same public
contracts by hand.

## Dev setup on a new machine

**Prerequisites**

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 (see [`.nvmrc`](.nvmrc)) | `nvm use` picks it up |
| pnpm | 11.13.0 | Pinned via `packageManager`; `corepack enable` installs it for you |
| A Cloudflare account | — | **Not needed for development.** Only for deploying. |

Nothing else. No Docker, no database to install, no cloud account, no payment
method.

```bash
git clone git@github.com:eigeninteractive/eigen-server.git
cd eigen-server
corepack enable          # once per machine, if pnpm isn't already installed
pnpm install
pnpm -r build            # workspace packages resolve through dist/, so build first
pnpm -r test             # 160+ tests across the four packages + the example
```

Then run the example Worker:

```bash
cd examples/rps
cp .dev.vars.example .dev.vars
pnpm dev                 # wrangler dev — local DO, D1, R2 and cron simulation
```

`.dev.vars` holds **placeholders on purpose**. Every feature they gate (push,
account deletion via Identity Toolkit, external bots) is simply *off* when
unconfigured, and that is the intended local behaviour — don't put real
credentials there. Auth still works: `@eigeninteractive/server/testing` mints local tokens
the real auth middleware accepts, which is how the suites exercise the real
Durable Object and real D1 with no Firebase project.

Tests run under `@cloudflare/vitest-pool-workers`, inside the real `workerd`
runtime. A passing test has exercised the actual DO input gate, the actual
SQLite and the actual alarm scheduler — not mocks of them.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm -r build` | Build every workspace package |
| `pnpm -r test` | Run every suite |
| `pnpm -r typecheck` | `tsc --noEmit` across the workspace |
| `pnpm lint` / `pnpm format` | Biome check / check-and-write |
| `pnpm openapi` | Re-emit `packages/server/openapi.json` from the routes |
| `pnpm --filter @eigeninteractive/server db:generate:d1` | Generate a D1 migration from the drizzle schema |
| `cd examples/rps && pnpm dev` | Run the example Worker locally |

Run `pnpm exec wrangler types` in a Worker after changing its bindings in
`wrangler.jsonc`.

## The wire loop

`openapi.json` is a **committed, generated** artifact: it is emitted from the
route definitions here and is what the Dart client is generated from. The two
repos have no other coupling, so the rule is absolute — after any wire change,
re-emit the spec and regenerate the client **in the same change**:

```bash
pnpm openapi                                  # here
cd ../eigen-flutter && ./tool/generate_api.sh # there
```

CI fails if `openapi.json` is stale relative to the routes.

Two consequences worth knowing before you touch a schema:

- **Fix wire awkwardness at the source.** A shape the generated Dart client
  consumes badly gets fixed in the zod schemas here — never patched around in
  Dart.
- **Response enums tolerate widening.** The Dart client maps a member it does
  not know to `unknownDefaultOpenApi`, so adding a response value does not
  break decoding. The sentinel is read-side only: clients must never send it
  back. Removing or renaming a value remains breaking, as does requiring an
  old client to send a newly added request value.

## Deploying

Deploying is deliberately a local, credentialed action — CI never does it,
because `pnpm deploy` applies D1 migrations against a real database.

```bash
cd examples/rps                # or your own worker
pnpm exec wrangler login
pnpm exec wrangler secret put FIREBASE_CLIENT_EMAIL   # if push / account deletion is wanted
pnpm exec wrangler secret put FIREBASE_PRIVATE_KEY
pnpm exec wrangler secret put BOT_SIGNING_SECRET      # if external bots are wanted
pnpm deploy                    # migrations apply --remote, then wrangler deploy
```

Migrations apply **before** the code goes out, so new code never meets an old
schema. `curl https://your-worker/health` is the first post-deploy check — it is
public, does no I/O, and confirms the Worker is deployed and routable (and only
that; an empty `FIREBASE_PROJECT_ID` leaves it green while every authed request
500s). `docs/architecture.md` §17 has the full bindings/vars/secrets table, the
bot-registration SQL, and a first-deploy checklist.

Day 0 runs entirely on the **Workers free plan with no payment method**. A card
is first required only by a real R2 bucket for avatar uploads; the free →
paid upgrade after that is one click and zero code change.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every PR and push
to `main`: Biome, `pnpm -r build`, `pnpm -r typecheck`, `pnpm -r test`, and the
`openapi.json` drift guard. It needs **no Cloudflare credentials** — the Workers
tests boot `workerd` locally — and it never deploys.
