---
sidebar_position: 1
title: Quickstart
description: Scaffold a game Worker and Flutter app, generate the shared payload contract, and run both halves locally.
---

# Quickstart

You build an Eigen game in your own repository. The engine repositories are
ordinary dependencies; game implementors do not clone them.

## Scaffold both halves

After the first packages are published:

```bash
# pnpm
pnpm create eigen-game my-game

# or npm
npm create eigen-game@latest my-game
```

The default is a single repository:

```text
my-game/
├── server/   # Cloudflare Worker and authoritative TypeScript rules
└── app/      # Flutter app and presentation rules
```

The scaffold intentionally supports only this combined layout for now. The
generated files use only public npm/pub.dev contracts, so teams that prefer
separate repositories can create either half by hand. The scaffold is
convenience, not a runtime requirement.

Until publishing is enabled, engine contributors can build and run the CLI from
`eigen-server/packages/create-eigen-game`; package installation is deliberately
left for the publishing pass.

## Generate the game contract

Declare `state`, `observation`, `action`, and `config` as Standard JSON Schema
capable schemas beside the Worker rules. Then:

```bash
cd server
pnpm install                 # npm install is supported too
pnpm contract                # writes deterministic game-contract.json
```

`game-contract.json` is the game-owned boundary between repositories. It
contains every schema version plus the validated twin fixtures. Commit it,
publish it as a release artifact, or copy it into the app build; no particular
repository layout is assumed.

Generate the Dart payload library and fixture copies:

```bash
cd ../app
flutter pub get
dart run eigen_flutter:generate_payloads \
  --contract ../server/game-contract.json \
  --output lib/game/generated/payloads.dart \
  --fixtures-output test/fixtures
flutter test
```

The output is immutable plain Dart with deep value equality, field-aware decode
errors, and a `GamePayloadCodec`. A game does not install Freezed,
`json_serializable`, or `build_runner` for payload types.

## Run locally

```bash
cd server
pnpm dev
curl http://localhost:8787/health
```

`wrangler dev` simulates the Worker resources locally. Running the full Flutter
app against it additionally requires Firebase configuration; pure rules,
fixture, and widget tests do not.

## Keep generation honest

Run generation in write mode during development and check mode in CI:

```bash
dart run eigen_flutter:generate_payloads \
  --contract game-contract.json \
  --output lib/game/generated/payloads.dart \
  --check
```

When the two halves are separate repositories, promote one exact
`game-contract.json` by checksum. Deploy an Android build supporting a new game
schema before server responses start requiring it. Web clients can show the
same update state and reload to fetch the latest deployed bundle.

Next, read [Your first game](./your-first-game.md) and
[Payload types](../build-a-game/schemas.md).
