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

The implementor documentation lives at
**[eigeninteractive.com](https://eigeninteractive.com/docs/intro)**:

- [Quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
- [The TypeScript + Dart game contract](https://eigeninteractive.com/docs/build-a-game/the-contract)
- [Deploy the Worker](https://eigeninteractive.com/docs/ship-it/deploy-the-worker)
- [How the engine works](https://eigeninteractive.com/docs/how-it-works/overview)
- [TypeScript API](https://eigeninteractive.com/docs/reference/typescript)

[`docs/todo.md`](docs/todo.md) is the engine-maintainer backlog, not product
documentation.

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
└── docs/todo.md       # engine-maintainer backlog
```

`kernel` is deliberately platform-free: it knows nothing about Workers, D1 or
Durable Objects, which is what makes the game loop testable in isolation and
replayable years later.

## Scaffold a game

A game implementor starts with:

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
500s). The [deployment guide](https://eigeninteractive.com/docs/ship-it/deploy-the-worker)
has the full bindings/vars/secrets table, bot-registration flow, and a
first-deploy checklist.

Day 0 runs entirely on the **Workers free plan with no payment method**. A card
is first required only by a real R2 bucket for avatar uploads; the free →
paid upgrade after that is one click and zero code change.

## CI

The checks in [`.github/workflows/checks.yml`](.github/workflows/checks.yml) run
on every PR and push
to `main`: Biome, `pnpm -r build`, `pnpm -r typecheck`, `pnpm -r test`, and the
`openapi.json` drift guard. It needs **no Cloudflare credentials** — the Workers
tests boot `workerd` locally — and it never deploys.
