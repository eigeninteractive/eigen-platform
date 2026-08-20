---
sidebar_position: 2
title: The cross-repo contract
description: Engine packages are dependencies; a deterministic game contract carries payload schemas and fixtures between a game's Worker and Flutter repositories.
---

# The cross-repo contract

The Worker's schemas are authoritative; the app consumes one generated
artifact:

```text
TypeScript schemas + fixtures
              │
              ▼
      game-contract.json
              │
              ▼
 generated Dart payloads + fixture copies
```

A game's Worker owns its authoritative TypeScript rules and emits one
deterministic `game-contract.json`. The artifact contains the four payload
schemas for every `schemaVersion` plus validated behavioral fixtures. The
Flutter repository consumes the exact artifact to generate immutable Dart
payload types, the codec, and fixture copies.

This works in a combined repository, separate Worker/app repositories, or a
fully hand-created setup. The engine repositories remain ordinary npm/pub.dev
dependencies in all three.

## Dependency identity

Packages that exchange rule objects or inspect `IllegalMoveError` share
`@eigeninteractive/rules` as a peer dependency. This makes the application
select the compatible rules instance used in its dependency graph, preserving
constructor/symbol identity across those package boundaries. pnpm and npm are
the supported Node package managers. A normal transitive dependency may be
hoisted and deduplicated, but that install layout is not its contract and
nested copies remain valid.

The game Worker therefore declares `@eigeninteractive/rules` directly as well
as `@eigeninteractive/server`. This is intentional:

- `rules` is the small, platform-free contract the game implements;
- `server` is the Cloudflare deployment runtime that consumes that contract;
- `kernel`, `server`, and `testkit` bind their rules peer to the implementor's
  one direct installation.

`server` does not re-export the rules API. A re-export would create two
canonical import paths for the same contract while leaving the peer requirement
in place. Making rules a hidden transitive dependency instead would weaken the
single-instance guarantee, especially when testkit participates in the same
process.

In the combined scaffold, run `pnpm run contract` or `npm run contract` at the
repository root after changing schemas or fixtures. It emits the Worker
artifact and regenerates the Dart payloads and fixture copies. The matching
root `contract:check` checks both sides without writing; the underlying commands
remain available for split repositories.

## Promotion order

Treat the contract file as an immutable release input:

1. emit and test a new contract;
2. generate/test the Flutter app from that exact checksum;
3. release the compatible Android build to Play;
4. only then deploy Worker behavior that creates or returns the new
   `schemaVersion`.

This order matters even when Google Play handles delivery: rollout is not
instant and installed apps are not force-updated. The app already detects an
unsupported game schema and presents the update path. On web, the equivalent
action is a browser reload, which loads the current deployed bundle.

Additive engine transport enums do not require this dance: generated Dart
transport enums decode an unknown member as `unknownDefaultOpenApi`. Game
payload enums remain schema-versioned because an unknown move cannot be acted
on or safely serialized back.

## CI checks

The Worker regenerates `game-contract.json` and fails on a diff. The app runs
`eigen_codegen:generate_payloads --check` and its copied fixtures. Separate
repositories can fetch the artifact from a release, registry, or object store;
pin it by checksum instead of depending on a sibling checkout path.

See [Payload types](../build-a-game/schemas.md) and
[Versions and compatibility](compatibility.md).
