---
sidebar_position: 2
title: The cross-repo contract
description: The game rules exist twice — TypeScript on the server, Dart on the client — and shared fixtures keep the twins honest.
---

# The cross-repo contract

The game rules exist **twice**: as TypeScript (server-authoritative, in the
engine repo) and as Dart (client-side optimistic preview + rendering, in the
client repo). The two are kept honest by **shared JSON fixtures per version
unit**, run by both the TS and Dart test runners — a drift between the twins
fails a test on both sides.

The engine generates the OpenAPI spec that the client's transport is generated
from. This is why the contract in `@eigen/rules` is small and precise: it is the
seam two languages meet at.

```text
          ┌──────────────────── @eigen/rules ────────────────────┐
          │  GameRules · GameModule · the six hooks · Envelope   │
          └──────────────────────────────────────────────────────┘
                    │                              │
        TypeScript twin                      Dart twin
     (authoritative, server)          (optimistic preview, render)
                    │                              │
                    └────── shared JSON fixtures ──┘
                            run by both runners

          openapi.json ──────► tool/generate_api.sh ──────► typed Dart client
```

Two rules follow from this and are not negotiable:

- **Fix the wire, not the client.** A shape the generated Dart client consumes
  badly gets fixed in the zod schemas in the engine and regenerated — never
  patched around in Dart. Re-emit `openapi.json` and rerun the client's
  generator **in the same change**, because the two repos have no other coupling
  that would catch the drift.
- **Wire enums are closed sets.** The Dart client generates enums with no
  `unknown` sentinel and parses strictly, so adding a member to any enum on the
  wire is a breaking change needing a schema-version bump and a coordinated
  client release.

For how to write a game against that contract, see
[Build a game](../build-a-game/game-module.md). For the twin-fixture mechanics,
see [Testing your game](../build-a-game/testing.md).
