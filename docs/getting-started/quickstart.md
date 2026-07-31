---
sidebar_position: 1
title: Quickstart
description: Scaffold a game Worker and Flutter app, generate the shared payload contract, and run both halves locally.
---

# Quickstart

You build an Eigen game in your own repository. The engine repositories are
ordinary dependencies; game implementors do not clone them.

## Prerequisites

- Node.js 22 or newer;
- npm or pnpm;
- Flutter with Dart 3.9 or newer.

A Cloudflare account and Firebase project are needed to run the complete app
and deploy, but not to scaffold the project or test game rules.

## Scaffold both halves

```bash
# pnpm
pnpm create eigen-game my-game

# or npm
npm create eigen-game@latest my-game
```

`my-game` is the only naming input. It is a lowercase kebab-case slug; the
scaffolder derives `My Game`, `my_game`, and the `MyGame` type prefix from it.

The default is a single repository:

```text
my-game/
├── server/   # Cloudflare Worker and authoritative TypeScript rules
└── app/      # Flutter app and presentation rules
```

The scaffold intentionally supports only this combined layout. It composes a
  canonical C3-style Cloudflare Worker template with
  `flutter create --empty --platforms android,web`,
installs both halves, emits the initial `game-contract.json`, and generates the
initial Dart payload types and rules base. The generated files use only public
npm/pub.dev contracts, so teams that prefer separate repositories can create
either half by hand. The scaffold is convenience, not a runtime requirement.

Prefer to create the repositories yourself or add Eigen to an existing app?
Follow [Set up without the scaffolder](./manual-setup.md). It uses the same
public contracts and supports independent Worker and app repositories.

## Generate the game contract

The scaffold has already performed the first generation. After changing
`state`, `observation`, `action`, `config`, or a shared fixture, regenerate:

```bash
pnpm run contract            # from the generated repository root
# npm run contract is supported too
```

`game-contract.json` is the game-owned boundary between repositories. It
contains every schema version plus the validated twin fixtures. Commit it,
publish it as a release artifact, or copy it into the app build; no particular
repository layout is assumed.

The root command also generates the Dart payload library and fixture copies.
The underlying commands remain independently usable when the halves live in
separate repositories:

```bash
cd app
dart run eigen_flutter:generate_payloads \
  --contract ../server/game-contract.json \
  --output lib/game/generated/payloads.dart \
  --fixtures-output test/fixtures
flutter test
```

The output is immutable plain Dart with deep value equality, field-aware decode
errors, and a typed abstract rules base. A game does not install Freezed,
`json_serializable`, `build_runner`, `code_builder`, or `dart_style` for these
payloads; the executable owns its generation implementation.

## The development loop

The scaffold includes one v1 fixture and both fixture runners. Keep the
TypeScript runner watching while editing rules:

```bash
cd server
pnpm run test:watch          # or: npm run test:watch
```

After changing a schema or fixture, refresh the cross-language artifact and
the generated Dart side:

```bash
cd ..                        # repository root
pnpm run contract

cd app
flutter test
```

Changing only TypeScript hook behavior does not necessarily change the
schemas, but update its shared fixture and run the same sequence: fixtures are
part of `game-contract.json`. `wrangler dev` reloads Worker source; it does not
regenerate the contract or Dart files.

Before anything has shipped, freely edit the seeded v1 unit. Once persisted
games or released clients depend on v1, make an incompatible change in a new
v2 unit and keep both registry entries.

## Run locally

```bash
cd server
pnpm dev
curl http://localhost:8787/health
```

`wrangler dev` simulates the Worker resources locally. Running the full Flutter
app against it additionally requires Firebase configuration; pure rules,
fixture, and widget tests do not.

Run the browser at the stable origin already allowed by the Worker scaffold:

```bash
cd app
flutter run -d chrome --web-hostname localhost --web-port 7357 \
  --dart-define-from-file=app-config.json
```

Run `pnpm firebase:configure` (or `npm run firebase:configure`) from the
generated repository root. It configures Android and Web with FlutterFire and
generates the service worker's matching public Firebase configuration. Then
finish the required public values and VAPID key in `app-config.json` as shown in
[Deploy the web app](../ship-it/deploy-the-web-app.md). Copy
`server/.dev.vars.example` to `server/.dev.vars` and fill the Admin credentials
from that same Firebase project before running authenticated Worker traffic.

The Worker template uses Wrangler-generated `Env` types and a stable `GAME_DB`
binding. Wrangler automatically provisions its D1 database on first remote
use; the deploy script applies the engine migrations before deploying.

## Keep generation honest

Run generation in write mode during development and check mode in CI:

```bash
pnpm run contract:check      # generated repository root
```

When the two halves are separate repositories, promote one exact
`game-contract.json` by checksum. Deploy an Android build supporting a new game
schema before server responses start requiring it. Web clients can show the
same update state and reload to fetch the latest deployed bundle.

Next, read [Your first game](./your-first-game.md) and
[Payload types](../build-a-game/schemas.md).
