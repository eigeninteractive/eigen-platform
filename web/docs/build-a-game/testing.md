---
sidebar_position: 10
title: Testing
description: One fixture file, two language runners, plus the widget and integration layers and the CI that keeps them aligned.
---

# Testing

Your rules exist twice. **Shared JSON fixtures record the expected behaviour once
and run against both halves**, so a divergence fails a test in whichever language
drifted. That is the load-bearing layer; everything else on this page is ordinary
testing.

Nothing here needs a Cloudflare account, a Firebase project or a network.

## Twin fixtures

A fixture file is a list of cases, keyed to one `schemaVersion`:

```json
{
  "schemaVersion": 1,
  "cases": [
    {
      "kind": "action",
      "name": "first commit of a round is recorded and hidden",
      "config": { "targetWins": 1 },
      "state":  { "round": 1, "wins": [0,0], "commits": [null,null], "lastRound": null },
      "obs":    { "round": 1, "wins": [0,0], "lastRound": null, "yourMove": null },
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

`kind` is `action`, `playerLimits`, `ratingPool`, `botSeatable`, `initialState`,
`lifecycle`, `transcript`, or `rng`. The two runners read the same file and
check different things:

| Field | TypeScript runner | Dart runner |
|---|---|---|
| `state` | input to `applyAction` | n/a |
| **`obs`** | ignored | input to `isValidAction` / `previewAction` |
| `action` | parsed by `schemas.action` | parsed and serialized by the generated rules base |
| `expected.valid` | `applyAction` throws or not | `isValidAction` |
| `expected.state` / `pending` / `outcome` | the returned envelope | n/a |
| `expected.observation` | `computeObservation` output | `previewAction` output, **when non-null** |

### `obs` is the field hidden-information games need

It defaults to `state`, which is correct only for a perfect-information game
where the two coincide. **A game with fog must set it explicitly**, or else
the Dart runner hands your codec a payload `computeObservation` would never
produce, and the failure looks like a codec bug rather than a missing field.

### `expected.observation` is the shared anchor

Both sides are compared through one recorded value: the TypeScript side must
*project* to it, and a Dart `previewAction` that returns non-null must *predict*
it. A `previewAction` returning null skips the check; that is a correct answer,
not a gap, so a game like RPS simply has no preview coverage here.

## The four kinds for offline play

`initialState`, `lifecycle`, `transcript`, and `rng` exist for
[offline play](./offline-play.md): a device runs the Dart twin through a Dart
port of the kernel, so the pieces an online-only client never had to
reproduce — the opening state, the lifecycle hooks, a whole match, and the
random stream itself — each need a recorded behavior of their own. The
TypeScript runner always checks all four, the same as any other kind, because
the TypeScript hooks are unconditionally authoritative. The **Dart** runner's
behavior differs by kind:

| kind | Dart runner |
|---|---|
| `initialState`, `lifecycle`, `transcript` | Run against the version's `LocalGameRules` **only when it ships one**; a version with no local unit has nothing to check and the case is skipped there |
| `rng` | Runs **unconditionally**, against `EigenRng` directly — it has no rules unit to call, so it applies even to a version with no local play |

```jsonc
{
  "kind": "initialState",
  "name": "a best-of-one opens with both seats pending",
  "config": { "targetWins": 1 },
  "playerCount": 2,
  "expected": {
    "state": { "round": 1, "wins": [0,0], "commits": [null,null], "lastRound": null },
    "pending": [0, 1],
    "outcome": null
  }
}
```

`initialState` runs `initialState` with the version-0 stream (`deriveRng(seed,
0)`, the same one the engine's `start` command derives) and checks the
returned envelope exactly as an `action` case does. `lifecycle` is the same
idea for `applyLifecycle`, given the engine-built payload (`{"type":
"timeout"}`, or `{"type", "playerIndex"}`) and the kernel's own forfeit guard
(a forfeit must remove its own seat from `pending`):

```jsonc
{
  "kind": "lifecycle",
  "name": "the seat that did commit takes a one-sided timeout",
  "config": { "targetWins": 1 },
  "state": { "round": 1, "wins": [0,0], "commits": ["rock",null], "lastRound": null },
  "pending": [1],
  "type": "timeout",
  "expected": {
    "state": { "round": 1, "wins": [0,0], "commits": ["rock",null], "lastRound": null },
    "pending": [],
    "outcome": [
      { "playerIndex": 0, "result": "win", "placement": 1, "teamIndex": 0 },
      { "playerIndex": 1, "result": "loss", "placement": 2, "teamIndex": 1 }
    ]
  }
}
```

`transcript` replays a whole match through the real kernel `commit()`, so
every engine guard, the pending/version bookkeeping, and the per-transition
`deriveRng(seed, version)` streams all participate — the one case a Dart local
kernel has to reproduce move for move. It plays out on a fixed table that is a
contract with the Dart runner:

- untimed and unrated (no deadline is ever armed, no clock is ever read);
- a roster of `playerCount` identified seats: seat 0 is the human `user-0`,
  every other seat is the bot `bot-<seat>`;
- the match opens with a `start` intent carrying the case's `seed`, so every
  transition draws from `deriveRng(seed, version)`;
- each transition commits at `expectedVersion` = the current version (a device
  is the only actor, so it is never stale), with `actor` `"user"` for seat 0
  and `"bot"` for the rest.

```jsonc
{
  "kind": "transcript",
  "name": "a best-of-one played to its finish",
  "config": { "targetWins": 1 },
  "playerCount": 2,
  "seed": "rps-twin-transcript",
  "transitions": [
    { "kind": "game", "playerIndex": 0, "data": { "move": "rock" } },
    { "kind": "game", "playerIndex": 1, "data": { "move": "scissors" } }
  ],
  "expected": {
    "version": 2,
    "status": "finished",
    "pending": [],
    "outcome": [
      { "playerIndex": 0, "result": "win", "placement": 1, "teamIndex": 0 },
      { "playerIndex": 1, "result": "loss", "placement": 2, "teamIndex": 1 }
    ]
  }
}
```

A rejection or a broken invariant fails the case, naming the transition that
produced it: an engine that refuses the transcript is as much a divergence as
a wrong final state.

`rng` records raw `deriveRng` draws, compared with exact equality, no
tolerance: the Dart port is required to be bit-identical, not merely close,
because one drifted draw desynchronizes the next.

```jsonc
{
  "kind": "rng",
  "name": "seat 1's bot stream at version 2",
  "seed": "rps-twin-transcript",
  "version": 2,
  "seat": 1,
  "draws": [0.258..., 0.759..., 0.553..., /* … */]
}
```

Generate `rng` cases rather than hand-writing them — the values are the
TypeScript kernel's own, so they can only come from running it:

```ts
import { rngFixtureCase, writeRngFixture } from "@eigeninteractive/testkit";

writeRngFixture("src/module/fixtures/v1/rng.json", [
  rngFixtureCase({ name: "version 0", seed: "twin-fixtures", version: 0, count: 16 }),
  rngFixtureCase({ name: "seat 1's bot stream", seed: "twin-fixtures", version: 3, seat: 1, count: 16 }),
]);
```

`writeRngFixture` reads the `schemaVersion` from the `v<N>/` directory the
path is written into, validates the document, and writes formatted JSON; run
it as a one-off script whenever the RNG-consuming surface changes, not on
every test run.

## Wiring the two runners

**TypeScript**, one line from the testkit, under plain-Node vitest:

```ts
import { twinFixtureTests } from "@eigeninteractive/testkit";
import gameModule from "../../src/module/index.js";

twinFixtureTests(gameModule, new URL("../../src/module/fixtures/", import.meta.url));
```

**Dart**, rides `flutter test`:

```dart
import 'package:eigen_flutter/testing/twin_fixtures.dart';

void main() {
  const module = RpsModule();
  for (final suite in loadTwinFixtureSuites('test/fixtures')) {
    final rules = module.versions[suite.schemaVersion];
    group('twin fixtures v${suite.schemaVersion}', () {
      for (final fixtureCase in suite.cases) {
        test(fixtureCase.name, () {
          expect(runTwinFixtureCase(rules!, fixtureCase), isEmpty);
        });
      }
    });
  }
}
```

Both expect a `v<N>/` directory layout and read `schemaVersion` from inside each
file. `eigen-contract` rejects a path such as `v2/case.json` whose document says
`"schemaVersion": 1`, or any fixture targeting a version absent from
`GameModule.versions`.

## What to cover

Write fixtures for the interesting states, especially hidden-information reveals
and `computeObservation` masking, because those are exactly where the two halves
drift. At minimum: one legal move with its expected observation, one illegal
move, one game-ending move, and one case per `playerLimits` / `ratingPool` /
`botSeatable` branch. `playerLimits` is worth a case even in a fixed-size game:
it is the only twin the server *enforces*, so drift there fails creation rather
than a pixel. Grow the suite with the rules.

## The other layers

**Widget tests for the screen.** `buildContent` takes a plain value object, so a
hand-built `GameContentContext` is the whole harness: no server, no socket, no
auth. See [Rendering](./rendering.md#testing-the-screen).

**Integration tests against the real runtime.** Drive the actual Worker (routes +
Durable Object + D1) with `@cloudflare/vitest-pool-workers`, using
`@eigeninteractive/server/testing` to mint local tokens. The engine's own suites cover the
plumbing (lobby, sockets, timing, finish, ratings, purge) so your job is *your
game* end to end: a full match, a timeout resolution, a bot game.

## CI

Both halves are plain commands with no secrets. The engine packages arrive as
published dependencies, so an implementor does not build the engine workspace:

```bash
# combined scaffold, from the repository root
pnpm run contract:check

# server/
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test

# app/
flutter pub get
flutter analyze
flutter test
```

The root `contract:check` composes the server contract check and Dart generator
check. In separate repositories, run those two underlying commands in their
respective pipelines instead.

The scaffold supplies the initial `test/twin.spec.ts`,
`test/game/twin_fixtures_test.dart`, and v1 fixture. Grow those tests with the
rules rather than replacing their wiring.

:::danger[Do not deploy from CI]

`wrangler d1 migrations apply --remote` mutates a real database, and a deploy is
the one action in this system that re-running a job cannot reverse. Keep it a
deliberate, credentialed `pnpm deploy` from a machine, or, if you want
push-button deploys, connect the repo to Cloudflare **Workers Builds** so the
deploy is owned by Cloudflare rather than by a long-lived API token sitting in
GitHub secrets.

:::

## The artifact promotion gate

Fixtures have one authored home: `server/src/module/fixtures`. The contract CLI
validates and embeds them in `game-contract.json`; the Dart generator copies
those exact documents into the app. Do not hand-edit `app/test/fixtures`.

In separate repositories, promote one exact contract artifact by checksum.
The app's generator `--check` then proves that its payload types and fixture
copies came from that artifact. This turns cross-repository drift into a normal
generated-file failure rather than a manual directory comparison.
