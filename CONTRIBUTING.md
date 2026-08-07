# Contributing to eigen-server

This repository contains the TypeScript half of the engine: four published
packages, the generated `eigen_api` Dart client, and the RPS reference Worker.

Game-implementor documentation lives at
[eigeninteractive.com](https://eigeninteractive.com). This guide is for people
changing engine code. Release credentials, registry setup, publishing, and
production operations live in [MAINTAINERS.md](MAINTAINERS.md).

## Getting set up

Prerequisites are Node.js 24 (see `.nvmrc`), pnpm 11.13.0, and a JDK for Dart
client generation.

```bash
corepack enable
pnpm install
pnpm -r build
pnpm -r test
pnpm -r typecheck
pnpm exec biome check .
```

Build before typechecking or testing: workspace packages resolve each other
through their published `exports`, which point at `dist`.

That is also true of a game repository pointed at this checkout, so while you
are changing the engine, leave a watcher running rather than rebuilding by
hand — a forgotten `pnpm -r build` means the game is testing a stale engine,
which fails as a puzzle rather than as an error:

```bash
pnpm dev          # tsup --watch in every library, rebuilds in milliseconds
```

`dist` is deliberately not cleaned between watch rebuilds. It is emptied and
rewritten on a one-shot `pnpm -r build`, which has no concurrent reader; during
a watch a linked game does, and a reader that arrives mid-rebuild would find
nothing there at all.

No Cloudflare account, Firebase project, or payment method is needed. Wrangler
simulates Durable Objects, D1, R2, and cron locally, while
`@eigeninteractive/server/testing` mints tokens accepted by the real auth
middleware.

Run the reference Worker with:

```bash
cd examples/rps
cp .dev.vars.example .dev.vars
pnpm dev
```

The example variables are placeholders. Features that require external
credentials remain disabled locally.

## Branching

Work on a branch and open a pull request. `main` is protected and is the only
branch that releases.

## The CI gate

Every pull request runs lint, build, typecheck, and tests, plus drift guards for
committed generated artifacts:

| Guard | Run locally |
|---|---|
| OpenAPI document | `pnpm openapi` |
| Dart REST client | `pnpm dart-client` |
| D1 and Durable Object migrations | the `db:generate:*` command for the changed schema |
| Worker binding types | `pnpm exec wrangler types` in the affected Worker |

If a drift guard fails, run the command it names and commit the result. Never
hand-edit generated artifacts to make the check pass.

## Running the scaffolder from source

Publishing to npm is not part of the loop. Build it and run the CLI directly —
same arguments as `pnpm create eigen-game`:

```bash
pnpm --filter create-eigen-game build
node packages/create-eigen-game/dist/cli.js ../my-game
```

The generated project resolves the engine from npm, which is what you want while
iterating on the CLI and its templates: it is exactly what a user gets.

To test the templates against the engine in your working tree instead — an
unreleased engine change, seen from a game author's side — run the CI gate,
which scaffolds into a temp directory with the four engine packages overridden
to `link:` this workspace:

```bash
pnpm -r build
node packages/create-eigen-game/scripts/scaffold-e2e.mjs
```

## The generated Dart client

`clients/dart` is the published `eigen_api` package. It is generated from
`packages/server/openapi.json` and committed so every wire change produces a
reviewable Dart diff in the same pull request.

After changing a route or wire schema, run:

```bash
pnpm openapi
pnpm dart-client
```

The Dart generator uses the pinned OpenAPI Generator version in
`openapitools.json` through `pnpm dlx`; it therefore needs a JDK on `PATH`.
Everything under `clients/dart` is generated except:

- `pubspec.yaml`
- `analysis_options.yaml`
- `.openapi-generator-ignore`

The generation script stamps the Dart package and OpenAPI document from
`@eigeninteractive/server`'s version. Do not edit generated source or version
fields by hand.

Generated response enums contain `unknownDefaultOpenApi`. Code that exhaustively
switches over one must handle that read-side sentinel, normally by surfacing an
update-required state. It must never be serialized back to the server.

## Describing your change

The four engine packages use Changesets and share one fixed version.
`create-eigen-game` uses Changesets too but versions on its own, so a change to
the scaffolder or its templates releases only the scaffolder. Add a changeset in
the pull request that introduces a user-visible change:

```bash
pnpm changeset
```

Write the line package consumers should read. Purely internal work uses:

```bash
pnpm changeset --empty
```

While packages are pre-1.0, choose:

| Change | Changeset bump |
|---|---|
| Breaking | `minor` |
| Additive or corrective | `patch` |
| Internal only | empty changeset |

Do not choose `major` before a deliberate 1.0 stability release. Changesets
applies the requested bump literally; it does not translate SemVer rules for
0.x packages.

Adding a response-enum member is normally additive because the generated Dart
client has an unknown-value sentinel. Removing or renaming a member remains
breaking, as does requiring an existing client to send a newly added request
value. The release-order implications are covered in
[MAINTAINERS.md](MAINTAINERS.md#client-first-wire-changes).

## Changes that cross repositories

`eigen-web` vendors the OpenAPI and TypeScript references. A release dispatches
a regeneration pull request automatically, but authored prose does not update
itself. Change the relevant guide in the same work.

The RPS twin fixture is maintained in both engine repositories:

```text
examples/rps/src/module/fixtures/v1/rps.json
eigen-flutter/example/fixtures/v1/rps.json
```

A rules change that affects fixtures must update both copies. The `obs` field is
the acting seat's observation; omitting it means the observation and state are
identical.

## Documentation changes

Public behavior belongs in the task-first guides in
[`eigen-web`](https://github.com/eigeninteractive/eigen-web), with the
TypeScript and Dart halves on the same page. Package API detail belongs in
TSDoc on the exported declaration so `pnpm sync-api` can regenerate the
reference.

Repository-development instructions belong here. Privileged operational
instructions belong in [MAINTAINERS.md](MAINTAINERS.md).
