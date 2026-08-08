---
sidebar_position: 9
title: Testing
description: One fixture file, two runners, two repos, plus the widget and integration layers, the CI that runs them, and the coupling CI cannot see.
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

`kind` is `action`, `ratingPool` or `botSeatable`. The two runners read the same
file and check different things:

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
  for (final suite in loadTwinFixtureSuites('fixtures')) {
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
move, one game-ending move, and one case per `ratingPool` / `botSeatable` branch.
Grow the suite with the rules.

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

## The cross-repository gate

Fixtures have one authored home: `server/src/module/fixtures`. The contract CLI
validates and embeds them in `game-contract.json`; the Dart generator copies
those exact documents into the app. Do not hand-edit `app/test/fixtures`.

In separate repositories, promote one exact contract artifact by checksum.
The app's generator `--check` then proves that its payload types and fixture
copies came from that artifact. This turns cross-repository drift into a normal
generated-file failure rather than a manual directory comparison.
