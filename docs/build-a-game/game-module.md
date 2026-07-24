---
sidebar_position: 1
title: The mental model
description: Four facts that define the shape of everything you write, and the GameModule / GameRules contract.
---

# What you write, and what the engine owns

The promise of the engine is a sharp division of labour: **you write pure game
rules; the engine owns everything else** — persistence, serialization, timing,
sockets, reconnection, ratings, bots, auth, history, and the API. You never
touch a database, a Durable Object, a migration, or a socket. You implement one
small, precisely-typed contract, wire it into a Worker, and deploy.

Everything you write lives behind one interface, `GameModule`, from the
`@eigen/rules` package. That package is pure types plus two tiny helpers, and it
has zero engine dependencies — you can read it top to bottom in ten minutes.

## The mental model

An Eigen game is a **sequence of server-authoritative transitions**. The engine
holds an opaque blob of *your* state per game; each move calls one of your hooks
to produce the next blob, plus who may move next and (eventually) the outcome.
Four facts define the shape of everything you write:

1. **Your state is pure and opaque.** The engine stores and versions it but never
   looks inside. It holds *only* your game payload (board, deck, scores, fog) —
   never whose-turn or winner metadata; those are engine-owned. Your hooks are
   pure functions from `(state, input)` to a new state.

2. **The engine is authoritative; the client is a proposer.** A player's move is
   validated by *your* `applyAction` on the server. If it's illegal you throw;
   the engine rejects it. The client also runs a Dart twin of your rules for
   optimistic preview, but the server's answer is the truth.

3. **You never branch on version.** Rules are organized one unit per
   `schema_version`. The engine resolves a game's version once and calls the
   right unit's hooks — your hook bodies only ever see their own version's shapes.

4. **Determinism is required.** State must be a pure function of `(seed, ordered
   moves)`. Any randomness comes from an engine-provided, replay-stable `rng`.
   This is what makes history, reconnection, and preview all work — so no
   `Date.now()`, no `Math.random()`, no external reads inside a hook.

## `GameModule` and `GameRules`

A `GameModule` is just a map from `schema_version` to a `GameRules` unit:

```ts
import type { GameModule } from "@eigen/rules";
import { rulesV1 } from "./v1.js";

export const gameModule: GameModule = {
  versions: { 1: rulesV1 },
};
```

A `GameRules` unit is one version's **payload schemas + six hooks** (plus an
optional seventh for bots). The whole contract:

```ts
interface GameRules<TState, TAction, TConfig> {
  schemas: { state; action; config };                        // Standard Schema each

  initialState(args): Envelope<TState>;                      // seed a new game
  applyAction(args): Envelope<TState>;                       // a player's move
  applyLifecycle(args): Envelope<TState>;                    // timeout / forfeit
  computeObservation(args): ObservationSlice;                // per-seat view (fog)
  ratingPool(args): string | null;                           // rated? which pool?
  botSeatable(args): boolean;                                // may this bot sit?

  botActions?: Record<string, BotAction<TAction, TConfig>>;  // in-engine bot brains
}
```

Author each unit as a class `implements GameRules<State, Action, Config>` (or a
literal typed `: GameRules<…>`) so you get full type-checking, then register it
in the `versions` map. That's it — no base class to extend, no lifecycle to
manage.

The full types are in the [`@eigen/rules` reference](../reference/typescript/rules.md).

:::note The other half of your game is Dart

Every game also ships a same-keyed Dart `GameModule` in the client repo — the
payload codec, `isValidAction`, `previewAction`, the board rendering, and
display-only twins of `ratingPool` and `botSeatable`. See
[The Dart GameRules unit](../client/game-ui.md). The two halves are kept honest
by [shared fixtures](./testing.md).

:::
