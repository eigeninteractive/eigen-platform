---
sidebar_position: 1
title: The contract
description: A game is two same-keyed registries — a TypeScript one that decides and a Dart one that draws. What you write, member by member, and what the engine owns.
---

# What a game is

A game is **two same-keyed registries**, one per language:

- a **TypeScript `GameModule`** in your Worker — the rules that decide;
- a **Dart `GameModule`** in your app — the codec and the screen that draws.

Everything else is the engine's: persistence, serialization, timing, sockets,
reconnection, ratings, bots, auth, history, the API, and the game's website. You
never touch a database, a Durable Object, a migration, or a socket.

Both halves come from a package with no engine dependencies —
[`@eigeninteractive/rules`](../reference/typescript/rules.md) is pure types plus two tiny
helpers, and you can read it top to bottom in ten minutes.

## Four facts that shape everything you write

1. **Your state is pure and opaque.** The engine stores and versions it but never
   looks inside. It holds *only* your game payload (board, deck, scores, fog) —
   never whose-turn or winner metadata, which are engine-owned. Your hooks are
   pure functions from `(state, input)` to a new state.

2. **The server decides; the client proposes.** A move is validated by *your*
   `applyAction` on the server. If it is illegal you throw and the engine rejects
   it. The Dart half also checks legality, but only to grey out a button — the
   server's answer is the truth.

3. **You never branch on version.** Rules are organised one unit per
   `schemaVersion`, on both sides. The engine resolves a game's version once and
   calls that unit; your hook bodies only ever see their own version's shapes.

4. **Determinism is required.** State must be a pure function of `(seed, ordered
   moves)`. Randomness comes from an engine-provided, replay-stable `rng`. This
   is what makes history, reconnection and preview work — so no `Date.now()`, no
   `Math.random()`, no external reads inside a hook.

## The two halves, member by member

| Member | TypeScript `GameRules` | Dart `GameRules` |
|---|---|---|
| `schemas` — the payload contracts | ✅ Standard JSON Schema capable schemas | ✅ generated payload types and rules base |
| `initialState`, `applyAction`, `applyLifecycle`, `computeObservation` | ✅ authoritative | — the client consumes observations, it does not produce them |
| `isValidAction` | — `applyAction` *is* the check | ✅ UX-only transcription of its legality half |
| `previewAction` | — `applyAction` is the truth | ✅ required; the game's own optimistic projection (null ⇒ server-driven) |
| `buildContent` | — | ✅ the screen |
| `ratingPool`, `botSeatable` | ✅ enforced | ✅ display-only twin |
| `botActions` — bot brains | ✅ server-side | — client-side local bots do not exist |

Every "keep in sync" above is enforceable rather than aspirational: shared JSON
fixtures run against both units and fail a test on divergence. See
[Testing](./testing.md).

## The TypeScript half

A `GameModule` is a map from `schemaVersion` to a `GameRules` unit:

```ts
import type { GameModule } from "@eigeninteractive/rules";
import { rulesV1 } from "./v1.js";

export default {
  versions: { 1: rulesV1 },
} satisfies GameModule;
```

A unit is one version's payload schemas plus six hooks (and an optional seventh
for bots):

```ts
interface GameRules<TState, TObservation, TAction, TConfig> {
  schemas: { state; observation; action; config };           // validation + JSON Schema

  initialState(args): Envelope<TState>;                      // seed a new game
  applyAction(args): Envelope<TState>;                       // a player's move
  applyLifecycle(args): Envelope<TState>;                    // timeout / forfeit
  computeObservation(args): ObservationSlice;                // per-seat view (fog)
  ratingPool(args): string | null;                           // rated? which pool?
  botSeatable(args): boolean;                                // may this bot sit?

  botActions?: Record<string, BotAction<TAction, TConfig>>;  // in-engine bot brains
}
```

Author each unit as a literal or class typed
`GameRules<State, Observation, Action, Config>` so you get full type-checking,
then register it
in the `versions` map. No base class, no lifecycle to manage.

## The Dart half

The same keys, and the members from the right-hand column above:

```dart
class RpsRulesV1 extends RpsV1RulesBase {
  const RpsRulesV1();

  // Legality — the transcribed legality half of the TypeScript applyAction.
  @override
  bool isValidAction({
    required RpsV1Observation obs,
    required List<int> pending,
    required RpsV1Action data,
    required int playerIndex,
    required RpsV1Config config,
  }) => pending.contains(playerIndex) && !obs.committedBy(playerIndex);

  // Optimism — or null to stay server-driven.
  @override
  RpsV1Observation? previewAction({ /* same parameters */ }) => null;

  @override
  Widget buildContent(GameContentContext context) =>
      RpsBoard(context: context, rules: this);

  // Display-only twins of the TypeScript predicates.
  @override
  String? ratingPool(RatingPoolArgs args) =>
      args.access == GameAccess.public ? 'standard' : null;

  @override
  bool botSeatable(BotSeatableArgs args) => true;
}
```

…registered in a Dart `GameModule`, which also carries the version-independent
creation and About UI:

```dart
class RpsModule extends GameModule {
  const RpsModule();

  @override
  Map<int, GameRules> get versions => const {1: RpsRulesV1()};

  // …creationSpec, buildCreationConfig, buildRules — see Creation UI.
}
```

Four things that are easy to get wrong on this side:

- **Do not re-check whose turn it is** in `isValidAction` for the sequential
  case — the caller has already gated on `pending`. Check *move* legality. Games
  with interrupt actions (a "Nope" window) use `pending` to tell a main-turn
  action from an interrupt.
- **`playerIndex` is passed to every game** even when unused, so the contract
  stays uniform. Chess needs it (piece ownership); tic-tac-toe does not.
- **Turn-gating, game-over and winner derivation are engine facts**, surfaced as
  `frame.pendingPlayers`, `gameStatus` and `outcomes`. Never re-derive them.
- **The rules unit carries no player metadata.** Player counts are declared on
  `GameCreationSpec`; identities arrive via `PlayersContext`.

## One dependency, one import

A game app depends on **`eigen_flutter` alone** and imports **only its barrel**:

```dart
import 'package:eigen_flutter/eigen_flutter.dart';
```

Never `package:eigen_api/…` — that is a generated build artifact, rewritten
wholesale — and never a deep path into `lib/`. The barrel re-exports the wire
vocabulary a game renders from (`GameStatus`, `Outcome`, `Player`, `Seat`,
`Frame`, …) while keeping the generated `*Api` classes and their HTTP plumbing
out of your namespace:

> **Naming a type is part of the contract; calling the server is not.**

## What the engine owns, and you never reimplement

- **Persistence & serialization** — the per-game Durable Object, its SQLite, the
  input gate, versioning, idempotent retries.
- **The waiting room** — create, join (by id or code), leave, cancel, add-bot,
  start; short codes; guest and friends-access gating.
- **Sockets & reconnection** — one socket per game, pre-game roster snapshots,
  versioned frames, gap recovery by range fetch.
- **Timing** — deadlines, the chess-clock bank, the grace window, the durable
  alarm.
- **Ratings** — OpenSkill, the concurrency-safe CAS, pools, history. You only
  choose the pool via `ratingPool`.
- **Identity & auth** — Firebase token verification, provisioning, guests,
  account deletion.
- **History & replay** — the immutable transition log, compaction, and the replay
  path (your `computeObservation` is reused to project it).
- **The whole app shell** — sign-in, home, lobby, friends, profile, settings,
  history, replay, offline UX, push registration, deep links, analytics.
- **Bots infrastructure**, **avatars**, and the entire **HTTP/OpenAPI surface**.

:::tip[A useful smell test]

If you find yourself reaching for a database, a socket, a clock, or a lock inside
a hook — stop. The engine already did it, and doing it in a hook would break
determinism.

:::
