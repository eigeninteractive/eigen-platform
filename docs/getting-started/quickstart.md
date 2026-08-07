---
sidebar_position: 2
title: Quickstart
description: Scaffold a game, run both halves locally, and make your first rules change.
---

# Quickstart

One command scaffolds both halves of a game — the Cloudflare Worker that owns
the rules and the Flutter app that draws them — into your own repository. You
never clone the engine; it arrives as ordinary npm and pub.dev packages.

## Before you start

Node.js 22 or newer, npm or pnpm, and Flutter 3.44 or newer, which brings the
Dart 3.12 the client needs. Scaffolding installs both halves as it goes, so it
needs network access.

A Cloudflare account and a Firebase project are needed to run the whole app, but
not to scaffold it or to test game rules.
[Prerequisites](./prerequisites.md) covers each of these with install links and
one command block that checks the lot.

## Scaffold

```bash
pnpm create eigen-game my-game
# or: npm create eigen-game@latest my-game
```

`my-game` is the only naming argument — a lowercase kebab-case slug, from which
the scaffolder derives `My Game`, `my_game` and the `MyGame` type prefix.

It asks one question:

```text
Organization in reverse domain notation [com.example]: dev.yourname.games
```

That becomes the Android `applicationId`, which is worth getting right at
scaffold time: Google Play treats it as the app's permanent identity and it
cannot be changed after the first upload. `--org dev.yourname.games` answers it
up front, which is also how it works with no terminal attached.

You get one repository holding both halves:

```text
my-game/
├── server/   # Cloudflare Worker — the authoritative rules
└── app/      # Flutter app — the screens
```

The scaffold commits itself when it finishes, so your first `git diff` is your
first game change rather than the ninety generated files underneath it. Pass
`--no-git` to skip that, as does scaffolding inside a repository you already
have.

The engine and `eigen_flutter` versions are pinned inside the scaffolder and
released as a tested pair, so the `create-eigen-game` you run decides both — use
`@latest` rather than a cached older copy. See
[Versions and compatibility](../reference/compatibility.md).

## Run it

```bash
cd server
pnpm dev                              # applies the D1 migrations, then wrangler dev
curl http://localhost:8787/health
```

`wrangler dev` simulates D1, the Durable Objects and the cron trigger locally.
`/health` answering `{"status":"ok"}` means the whole Worker stack is up, and
rules and fixture tests need nothing more than this.

The Flutter app needs Firebase first. From the repository root:

```bash
pnpm firebase:configure
```

That configures Android and web with FlutterFire and writes the service worker's
Firebase configuration. It asks which Firebase project to use, and can create
one; pass `-- --project my-project-id` to answer that up front.

Then fill in the public values and VAPID key in `app/app-config.json` — see
[Deploy the web app](../ship-it/deploy-the-web-app.md) — and copy
`server/.dev.vars.example` to `server/.dev.vars` with the Firebase Admin
credentials, which the Worker needs to verify player tokens.

```bash
cd app
flutter run -d chrome --web-hostname localhost --web-port 7357 \
  --dart-define-from-file=app-config.json
```

Port 7357 is the origin the Worker scaffold already trusts, so leave it as it is.

## The development loop

`wrangler dev` reloads Worker source on save, which covers most rules work.
What it does not do is regenerate anything: `game-contract.json` and the Dart it
produces are build outputs, not watched files.

Keep the fixture runner going while you edit rules:

```bash
cd server
pnpm run test:watch
```

Then run `pnpm run contract` from the repository root whenever a schema or a
fixture changes, and `flutter test` in `app/` to check the Dart side agrees.

## What a game is

A game is four Zod schemas and a handful of pure hooks, in one
[`GameRules`](../build-a-game/the-contract.md) unit:

- **`state`** is the authoritative truth, held by the Worker and never sent to a
  player.
- **`observation`** is the slice one seat is allowed to see, computed from
  `state`. It is what the app draws, and it is where
  [hidden information](../build-a-game/hidden-information.md) is enforced.
- **`action`** is what a player submits; `config` is what the creator chose
  before the game started.

Each unit is registered under a **schema version**, and shipped versions are
immutable — an incompatible change becomes a new `v2` unit beside `v1`, so games
already in progress keep the rules they started under. See
[Payload types](../build-a-game/schemas.md),
[The hooks](../build-a-game/hooks.md) and
[Versions](../build-a-game/versions.md).

## Change the rules

The seeded game is a race to a target count. Open
`server/src/module/v1.ts` and bound what a player may add per turn:

```ts
const actionSchema = z.object({ amount: z.int().min(1).max(3) }).meta({ id: "ExampleGameV1Action" });
```

That is a schema change, so regenerate the contract from the repository root:

```bash
pnpm run contract
```

It rewrites `server/game-contract.json` — every schema version plus the shared
fixtures — and from it the Dart payload types and fixture copies in `app/`.
Commit both: they are the boundary between the two halves, and the app now
rejects `amount: 4` before it ever reaches the Worker.

Changing hook *behaviour* rather than a schema works the same way, except that
you update the fixture in `server/src/module/fixtures/v1/` alongside it. The
fixtures are part of the contract, and both languages run them — that is what
keeps the app's prediction and the Worker's ruling from drifting apart.

Before anything has shipped, edit the seeded v1 unit freely.

---

Next: [Your first game](./your-first-game.md) walks through Rock–Paper–Scissors
in both languages. Prefer to wire the two halves up yourself, or add
EigenInteractive to an app you already have? See
[Set up without the scaffolder](./manual-setup.md).
