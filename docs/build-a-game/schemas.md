---
sidebar_position: 2
title: Payload types
description: Declare state, observation, action, and config once and generate immutable Dart payloads from the game contract.
---

# Payload types

One TypeScript declaration is authoritative for all four game payloads:

| Payload | Worker uses it for | Flutter uses it for |
|---|---|---|
| `state` | persisted authoritative state | never received |
| `observation` | the seat/public projection | rendering and preview |
| `action` | validating submitted moves | constructing/submitting moves |
| `config` | validating creation settings | creation and rendering |

The schemas must implement both Standard Schema validation and Standard JSON
Schema emission. Zod 4 does:

```ts
import { z } from "zod";

const moveSchema = z.enum(["rock", "paper", "scissors"]).meta({ id: "Move" });
const stateSchema = z.object({ round: z.int(), commits: z.array(moveSchema.nullable()) })
  .meta({ id: "State" });
const observationSchema = z.object({
  round: z.int(),
  yourMove: moveSchema.nullable().optional(),
}).meta({ id: "Observation" });
const actionSchema = z.object({ move: moveSchema }).meta({ id: "Action" });
const configSchema = z.object({ targetWins: z.int().min(1) }).meta({ id: "Config" });

export const rules: GameRules<State, Observation, Action, Config> = {
  schemas: { state: stateSchema, observation: observationSchema, action: actionSchema, config: configSchema },
  // hooks…
};
```

Give reusable/nested schemas stable `meta({ id: "…" })` names. These names
become stable Dart type names; wire keys themselves are preserved exactly.

The kernel validates state before commit and validates every observation after
`computeObservation`, including public/replay views. A projection bug therefore
fails at the source instead of becoming a Dart decoding mystery.

## Emit and consume the contract

The Worker owns the deterministic artifact. Default-export its module from
`src/module/index.ts` and declare its stable name:

```json
{
  "eigen": { "game": "Rps" },
  "scripts": { "contract": "eigen-contract" }
}
```

Then run:

```bash
pnpm contract
```

`@eigeninteractive/testkit` owns the executable and its `tsx` loader. By
convention it imports `src/module/index.ts`, reads fixtures from
`src/module/fixtures`, and writes `game-contract.json`. Optional `module`,
`fixtures`, and `contract` keys under `eigen` override those paths.

The artifact contains all versioned schemas and validated twin fixtures. The
Flutter app consumes that file:

```bash
dart run eigen_flutter:generate_payloads \
  --contract game-contract.json \
  --output lib/game/generated/payloads.dart \
  --fixtures-output test/fixtures
```

For each version the generator emits immutable classes/enums and a concrete
`GamePayloadCodec<TObservation, TAction, TConfig>`. Register it on the Dart
rules unit:

```dart
class RpsRulesV1 extends GameRules<RpsObservation, RpsAction, RpsConfig> {
  @override
  GamePayloadCodec<RpsObservation, RpsAction, RpsConfig> get payloadCodec =>
      const RpsPayloadCodec();

  // legality, optional preview, and UI remain handwritten
}
```

Unknown fields are ignored while known fields are decoded strictly. That is the
useful read-side balance: additive object fields survive an older app, while a
game-payload enum or incompatible shape still selects a new game
`schemaVersion`. The engine API's generated transport enums separately carry an
`unknownDefaultOpenApi` read fallback so additive engine enum values do not
crash an installed app.

The fallback is read-only. Never serialize an unknown sentinel as an action;
the generated action enum has no such member.

## Modelling the observation

The client never receives `state`. `computeObservation` returns the exact
audience-safe shape and the observation schema describes every allowed
projection. For example, live RPS may include `yourMove`, while a finished
public replay includes both commits. One observation schema can model that with
optional audience-specific fields.

Nothing confidential should be removed by Flutter UI logic. If a value must be
hidden, it must not appear in the observation bytes.

## Drift policy

Commit the contract and generated Dart. CI regenerates both and fails on a diff.
This catches schema changes, fixture drift, wire-key mismatches, and stale
generated payloads without requiring the Worker and app to share a repository.
