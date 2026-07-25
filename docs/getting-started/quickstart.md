---
sidebar_position: 1
title: Quickstart
description: Run both halves of the reference game locally in a few minutes — no Cloudflare account, no Firebase project, no payment method.
---

# Quickstart

A game is two halves, so this runs both. Neither needs a Cloudflare account, a
Firebase project, or a payment method: `wrangler dev` simulates Durable Objects,
their SQLite, D1, R2 and the cron trigger locally, and the client half's tests
need no backend at all.

## The server half

```bash
git clone https://github.com/eigeninteractive/eigen-server
cd eigen-server
pnpm install

pnpm -r build        # packages resolve through exports → dist, so build first
pnpm -r test         # kernel, rules, server, testkit
pnpm -r typecheck
```

Then start the example Worker — Rock–Paper–Scissors:

```bash
cd examples/rps
pnpm dev             # wrangler dev, with local DO / D1 / R2 simulation
```

Check it is up:

```bash
curl http://localhost:8787/health
# {"status":"ok"}
```

`/health` is public and does no I/O by design — it proves the Worker is routable
and nothing more. See
[what it does and does not prove](../ship-it/deploy-the-worker.md#what-health-proves).

## The client half

```bash
git clone https://github.com/eigeninteractive/eigen-flutter
cd eigen-flutter
flutter pub get
dart run build_runner build

cd example           # Rock–Paper–Scissors, the client half of the same game
flutter pub get
dart run build_runner build   # its payload types are Freezed, like a real game's
flutter test
```

Those tests are worth watching, because two of them are the whole point of the
architecture:

- **`twin_fixtures_test.dart`** runs the *same JSON fixtures* the server repo
  runs, against the Dart rules twin. One recorded behaviour, two languages.
- **`board_test.dart`** drives the actual game screen with no server, no socket
  and no auth — `buildContent` takes a plain value object, so the whole harness
  is about thirty lines.

Running the app against a live server needs a Firebase project, which is the one
thing this quickstart skips. See [Configuration](../ship-it/configure.md) when
you get there.

## What you now have

| | Server half | Client half |
|---|---|---|
| Where | `eigen-server/examples/rps` | `eigen-flutter/example` |
| What it owns | the rules that decide | the codec and the screen |
| The shared file | `src/rules/fixtures/v1/rps.json` | `fixtures/v1/rps.json` |

Those last two are byte-identical copies, run by both languages. That is the
mechanism that keeps the halves honest, and it is the thing worth understanding
first.

## What to read next

- **[Your first game](./your-first-game.md)** — the whole of RPS, both halves,
  side by side.
- **[The contract](../build-a-game/the-contract.md)** — what you write and what
  the engine owns, member by member.
- **[What the engine is](../how-it-works/overview.md)** — if you would rather
  start from the design than the code.
