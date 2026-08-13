---
sidebar_position: 1
title: Project layout
description: What a game repository owns, which generated files cross the Worker/app boundary, and when to use one repository or two.
---

# Project layout

Your game owns two deployable applications:

```text
server/   Cloudflare Worker + authoritative TypeScript rules
app/      Flutter application + client-side rules and presentation
```

The engine is not source you copy into either application. The Worker consumes
published `@eigeninteractive/*` packages from npm; the app consumes
`eigen_flutter` from pub.dev.

## Combined repository

Use one repository when the same team changes and releases both halves. This is
the layout produced by `create-eigen-game`:

```text
my-game/
├── package.json       # one contract / contract:check command
├── server/
│   ├── src/module/
│   └── game-contract.json
└── app/
    ├── lib/game/
    └── test/fixtures/
```

`pnpm run contract` emits the Worker contract and immediately regenerates the
Dart payloads and fixture copies. It is the shortest development loop and the
recommended starting point.

## Separate repositories

Use independent repositories when the Worker and app have different ownership,
permissions, or release cadence. No engine capability is lost.

The only game-specific artifact crossing between them is
`game-contract.json`, emitted from the Worker's authoritative schemas and
fixtures. Treat it like an API artifact:

1. the Worker emits and tests it;
2. CI publishes that exact file with a checksum;
3. the app pins the artifact, generates Dart, and runs its fixture tests;
4. the compatible app ships before the Worker begins returning the new schema.

The app never imports Worker source. The Worker never imports Dart output.

## Hand-created projects

The scaffolder adds no private runtime contract and intentionally has no
server-only or app-only modes. Existing projects can install the packages and
create the required entry points themselves; see
[Set up without the scaffolder](../getting-started/manual-setup.md).

npm and pnpm are the supported Node package managers. Do not publish manifests
with path dependencies or sibling-checkout overrides; those are local engine
development tools, not part of a game.

See [The cross-repository contract](./cross-repo.md) for artifact promotion and
[Quickstart](../getting-started/quickstart.md) for the combined flow.
