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

The engine generates the OpenAPI spec, generates the typed Dart client from it
**in the same repository**, and publishes that client to pub.dev at the engine's
own version. So the transport half is not a cross-repo contract at all any more —
it is an ordinary versioned dependency, and `eigen_api: ^1.2.0` in an app states
exactly the compatibility it means.

The *rules* half is the part that genuinely spans two repos, and it is why the
contract in `@eigen/rules` is small and precise: it is the seam two languages
meet at.

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

          openapi.json ──────► generated in-repo ──────► eigen_api on pub.dev
```

For the reference game the two twins and their fixtures are:

| | Server | Client |
|---|---|---|
| Rules | `eigen-server/examples/rps/src/rules/v1.ts` | `eigen-flutter/example/lib/src/v1/rules.dart` |
| Fixtures | `examples/rps/src/rules/fixtures/v1/rps.json` | `example/fixtures/v1/rps.json` |

Those two fixture files are byte-identical copies maintained by hand — **no
mechanism syncs them**, which is the one coupling neither repo's CI can see.

Two rules follow from this and are not negotiable:

- **Fix the wire, not the client.** A shape the generated Dart client consumes
  badly gets fixed in the zod schemas and regenerated — never patched around in
  Dart. Both happen in the engine repo, in the same change, and CI regenerates
  and diffs the client so a stale one cannot merge.
- **Wire enums are closed sets.** The Dart client generates enums with no
  `unknown` sentinel and parses strictly, so adding a member to any enum on the
  wire is a breaking change needing a schema-version bump and a coordinated
  client release.

For how to write a game against that contract, see
[Build a game](../build-a-game/the-contract.md). For the twin-fixture mechanics,
see [Testing your game](../build-a-game/testing.md).
