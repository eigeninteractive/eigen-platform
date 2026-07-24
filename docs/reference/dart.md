---
sidebar_position: 4
title: Dart API
description: Where the Flutter client's API reference lives.
---

# Dart API

The Flutter client ships two Dart packages:

| Package | What it is |
|---|---|
| **`eigen_flutter`** | The app shell, transport, state and presentation — the only package a game app depends on, imported through its single barrel. |
| **`eigen_api`** | The REST client generated from the server's `openapi.json`. A **build artifact**: `tool/generate_api.sh` deletes and rewrites it wholesale, and a game app never depends on it directly. |

:::info Not yet published

`eigen_flutter` is consumed as a **path dependency** today, so there is no
pub.dev listing and therefore no hosted dartdoc yet. Once it is published, its
generated API reference will live on pub.dev and be linked from here — that is
the idiomatic home for a Dart package's API docs, and duplicating it into this
site would only create a second thing to keep in sync.

In the meantime, generate it locally:

```bash
cd eigen-flutter
dart doc .
```

:::

For the hand-written client documentation — the contracts, the design and the
setup that isn't discoverable from the source — start at
[the client overview](../client/overview.md). The type-level contract a game
implements on the Dart side is in
[Building a game's client half](../client/game-ui.md).
