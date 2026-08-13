<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://eigeninteractive.com/brand/eigen-lockup-dark-360.png">
  <img src="https://eigeninteractive.com/brand/eigen-lockup-360.png" alt="EigenInteractive" width="270">
</picture>

# EigenInteractive Server

The server half of [EigenInteractive](https://eigeninteractive.com): a
server-authoritative engine for turn-based multiplayer games on Cloudflare
Workers.

Identity, lobbies, the authoritative game loop, timing, ratings, social
features, bots, push notifications, and deep links are built in. A game supplies
one TypeScript `GameModule` containing its schemas and rules.

The Flutter app framework lives alongside it in [`../flutter`](../flutter).

## Start a game

The recommended flow creates a Cloudflare Worker and Flutter application
together:

```bash
pnpm create eigen-game my-game
# or
npm create eigen-game@latest my-game
```

The scaffold installs published npm and pub.dev dependencies; it does not clone
the engine repositories. Teams using separate Worker and application
repositories can consume the same public packages and contract artifact
directly.

Follow the [quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
or [manual setup guide](https://eigeninteractive.com/docs/getting-started/manual-setup)
for both approaches.

## Packages

| Package | Use it to |
|---|---|
| `@eigeninteractive/rules` | Define the game module, payload schemas, hooks, observations, ratings, and bots |
| `@eigeninteractive/server` | Compose and deploy the Cloudflare Worker |
| `@eigeninteractive/testkit` | Test rules, emit `game-contract.json`, and validate twin fixtures |

`@eigeninteractive/kernel` is an engine-internal package. Games should use the
rules, server, and testkit APIs instead of importing the kernel directly.

One game becomes one Worker by passing its module and bindings to
`createEngine(...)`. The module's default export is the handoff:

```ts
// src/module/index.ts
import type { GameModule } from "@eigeninteractive/rules";
import { rulesV1 } from "./v1/rules";

export default {
  versions: { 1: rulesV1 },
} satisfies GameModule;
```

The Worker emits the module's Standard JSON Schemas and validated twin fixtures
as `game-contract.json`. `eigen_flutter` turns that artifact into immutable Dart
payloads and typed rules bases.

## Reference implementation

`examples/rps` is the Rock–Paper–Scissors Worker. It demonstrates simultaneous
hidden commitments, per-seat observations, contract generation, bots, and
integration testing in the real Workers runtime.

It is engine source, not application scaffolding. A generated game consumes the
published packages without cloning this workspace.

## Documentation

- [Quickstart](https://eigeninteractive.com/docs/getting-started/quickstart)
- [The TypeScript and Dart contract](https://eigeninteractive.com/docs/build-a-game/the-contract)
- [Payload generation](https://eigeninteractive.com/docs/build-a-game/schemas)
- [Testing both halves](https://eigeninteractive.com/docs/build-a-game/testing)
- [Deploy the Worker](https://eigeninteractive.com/docs/ship-it/deploy-the-worker)
- [TypeScript API reference](https://eigeninteractive.com/docs/reference/typescript)

## Working on the engine

- [CONTRIBUTING.md](CONTRIBUTING.md): local setup, tests, generated artifacts,
  Changesets, cross-repository changes, and pull requests.
- [MAINTAINERS.md](MAINTAINERS.md): registry setup, release operations, secrets,
  deployment, and failure recovery.
- [`docs/blockers.md`](docs/blockers.md): upstream limitations forcing a
  temporary workaround, across every EigenInteractive repository.
