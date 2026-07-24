---
sidebar_position: 9
title: Testing your game
description: Twin fixtures as the drift net between the TypeScript and Dart halves, plus integration tests against the real runtime.
---

# Testing your game

Two layers, both fast and offline.

## Twin fixtures (the drift net)

Your rules exist twice — TS in the engine repo, Dart in the client repo.
**Shared JSON fixtures** record expected behaviour once and run against both, so
a divergence fails a test on both sides. A fixture file is a list of cases:

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
import { twinFixtureTests } from "@eigen/testkit";
import { gameModule } from "../../src/rules/index.js";

twinFixtureTests(gameModule, new URL("../../src/rules/fixtures/", import.meta.url));
```

Write fixtures for the interesting states — especially hidden-info reveals and
`computeObservation` masking — because those are exactly where the TS and Dart
twins drift. Copy the observation your hook *should* produce for each seat into
`expected.observation`; the runner checks it byte-for-byte.

See the [`@eigen/testkit` reference](../reference/typescript/testkit.md) for the
full API.

## Integration tests

Drive the real Worker (routes + DO + D1) with `@cloudflare/vitest-pool-workers`,
using `@eigen/server/testing` to mint local test tokens. The engine's own suites
cover the plumbing (lobby, sockets, timing, finish, ratings, purge); your job is
to test *your game's* behaviour end-to-end where it matters — a full match, a
timeout resolution, a bot game.
