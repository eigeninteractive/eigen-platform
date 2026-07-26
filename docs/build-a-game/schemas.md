---
sidebar_position: 2
title: Payload types
description: Declare state, action and config once as Standard Schema on the server, then mirror them as a Dart codec — and why the observation is a fourth payload the client models separately.
---

# Payload types

Four payloads cross the JSON boundary. Three are declared on the server and
mirrored on the client; the fourth exists only on the client, and forgetting it
is the most common early mistake.

| Payload | Server | Client |
|---|---|---|
| `config` | schema | `parseConfig` |
| `action` | schema | `parseAction` / `serializeAction` |
| `state` | schema | **never seen** |
| **observation** | *produced* by `computeObservation` | `parseObservation` |

**The client never parses your state.** It parses what `computeObservation`
projected for one seat, which for a hidden-information game is a different shape
entirely. Model it as its own type.

## The server half — Standard Schema

Every payload is declared as a **Standard Schema** — bring Zod, Valibot,
ArkType, anything implementing the spec. The engine parses each payload with your
schema *before* your hook sees it, and re-validates the state your hook returns
before committing. Hook bodies never touch unvalidated JSON.

```ts
import { z } from "zod";

const moveSchema   = z.enum(["rock", "paper", "scissors"]);
const actionSchema = z.object({ move: moveSchema });
const configSchema = z.object({ targetWins: z.int().min(1).max(10) });
const stateSchema  = z.object({
  round: z.int().min(1),
  wins: z.tuple([z.int().min(0), z.int().min(0)]),
  commits: z.tuple([moveSchema.nullable(), moveSchema.nullable()]),
  lastRound: z.object({
    moves: z.tuple([moveSchema, moveSchema]),
    winner: z.union([z.literal(0), z.literal(1)]).nullable(),
  }).nullable(),
});

type Move   = z.infer<typeof moveSchema>;
type Action = z.infer<typeof actionSchema>;
type Config = z.infer<typeof configSchema>;
type State  = z.infer<typeof stateSchema>;
```

Three rules:

- **Use `type` aliases via `z.infer`, not `interface`s.** The engine's
  `JsonObject` constraint needs the implicit index signature a `type` gets and an
  `interface` does not.
- **Keep schemas transform-free.** What parses is what persists — do not reshape
  in the schema.
- **Schemas must validate synchronously.** The engine rejects an async schema as
  a game bug. Every mainstream library is sync unless you opt into async
  refinements.

## The client half — the codec

Four methods on the Dart `GameRules` unit, each delegating to a generated
`fromJson` / `toJson`:

```dart
@override RpsConfig parseConfig(Map<String, dynamic> j) => RpsConfig.fromJson(j);
@override RpsObservation parseObservation(Map<String, dynamic> j) => RpsObservation.fromJson(j);
@override RpsAction parseAction(Map<String, dynamic> j) => RpsAction.fromJson(j);
@override Map<String, dynamic> serializeAction(RpsAction a) => a.toJson();
```

Use **Freezed with `json_serializable`**. Two of its guarantees are load-bearing
rather than merely convenient:

- **Value equality, including collections.** The twin fixture runner compares
  observations with `==`, so a type without it quietly asserts nothing at all.
  Freezed compares `List` fields with deep equality, which matters because game
  payloads are mostly lists. A hand-written type must override `==` and
  `hashCode` itself, and get list comparison right.
- **Immutability.** An observation is a snapshot of one frame. Nothing on the
  client may edit it into the next one — the next one arrives from the server.

```dart
@freezed
abstract class RpsObservation with _$RpsObservation {
  const RpsObservation._();          // lets the class carry methods

  const factory RpsObservation({
    required int round,
    required List<int> wins,
    required RpsRound? lastRound,
    RpsMove? yourMove,               // live play only
    List<RpsMove?>? commits,         // replay only
  }) = _RpsObservation;

  factory RpsObservation.fromJson(Map<String, dynamic> json) =>
      _$RpsObservationFromJson(json);

  bool committedBy(int seat) =>
      commits != null ? commits![seat] != null : yourMove != null;
}
```

Two settings worth being deliberate about:

- **`field_rename` must match your schemas.** The JSON keys are whatever your
  TypeScript declares — `json_serializable` has no way to know them. The engine's
  own wire vocabulary is camelCase throughout, and RPS follows it (`yourMove`,
  `targetWins`), so neither `build.yaml` sets a rename at all. If your schemas
  declare snake_case keys, set `field_rename: snake` in *your* `build.yaml` and
  nowhere else. Getting this wrong silently breaks the codec; the fixtures, which
  carry the real wire keys, are what catch it.
- **`checked: true`** wraps a decode failure in a `CheckedFromJsonException`
  that names the offending field. A payload that fails to parse is a twin-drift
  bug report, and *"yourMove: `dynamite` is not one of the supported values"*
  is a far better one than a bare `ArgumentError`.

Whatever you generate, **`serializeAction` is the only place a typed action
becomes JSON**. Every producer — a human tap, a server bot, a replay cue —
routes through it, which is what stops them drifting.

## Modelling the observation

`computeObservation` may project a different **shape** per audience, and the
codec has to accept all of them. RPS emits two:

```jsonc
// live play — your own commit echoed back, the opponent's simply absent
{ "round": 2, "wins": [1, 0], "lastRound": {…}, "yourMove": "paper" }

// replay or public viewing — the match is over, nothing left to hide
{ "round": 2, "wins": [1, 0], "lastRound": {…}, "commits": ["rock", null] }
```

One Dart type covers both, with the audience-specific fields nullable:

```dart
class RpsObservation {
  final int round;
  final List<int> wins;
  final RpsRound? lastRound;
  final RpsMove? yourMove;        // live only
  final List<RpsMove?>? commits;  // replay only
  // …fromJson, ==, hashCode
}
```

The opponent's throw is not hidden by the UI — **it is not in the bytes that
reach the device**. There is no hidden field to render by accident, which is the
whole point of doing fog on the server. Handling both shapes is what hidden
information costs on the client, and it is the entire cost.

## The action payload

The engine defines **no** game-specific action type, exactly as it defines no
observation type. You own the shape, in three places that must agree: the human
tap, the server bot's JSON, and the TypeScript `applyAction` that consumes it.

Keep it minimal — it is *only* "what the move is". The engine supplies the seat,
the version, the RNG and the config as separate inputs, so never put them in the
payload.

## Enums are closed sets

Generated Dart enums parse strictly, with no `unknown` sentinel — and so should
your hand-written ones. Adding a member to any enum on the wire is therefore a
**breaking** change needing a schema-version bump, even though it looks purely
additive.

That is deliberate. Tolerant decoding buys silence, and silence is exactly wrong
when the two halves live in two repos with one generated seam between them.
Failing the build is loud, early, and in CI. See [Versions](./versions.md).
