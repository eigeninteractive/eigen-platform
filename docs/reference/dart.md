---
sidebar_position: 4
title: Dart API
description: The hosted, versioned API reference for eigen_flutter and its testing library.
---

# Dart API

Game apps use one package and one import:

```dart
import 'package:eigen_flutter/eigen_flutter.dart';
```

**[Open the latest `eigen_flutter` API reference on pub.dev →](https://pub.dev/documentation/eigen_flutter/latest/)**

The reference contains only the two supported library entry points:

| Library | Use it for |
|---|---|
| `package:eigen_flutter/eigen_flutter.dart` | App startup, configuration, the Dart `GameModule` / `GameRules` contract, generated wire vocabulary, and game-facing widgets. |
| `package:eigen_flutter/testing/twin_fixtures.dart` | Running the shared TypeScript/Dart contract fixtures from `flutter test`. |

Everything under the package's `core/`, `features/`, and `shared/` directories
is implementation detail. Do not deep-import it. If a task guide asks you to
use a type that is missing from the barrel, that is an engine API bug.

## Guide versus API reference

Use this site to complete a task; use pub.dev to look up an exact constructor,
member, or type:

- [The contract](../build-a-game/the-contract.md) explains what you implement
  on both the TypeScript and Dart sides.
- [Rendering](../build-a-game/rendering.md) covers `GameContentContext`,
  actions, optimistic preview, seats, and widget tests.
- [Creation UI](../build-a-game/creation-ui.md) covers `GameCreationSpec` and
  the version-independent module UI.
- [Testing](../build-a-game/testing.md) covers the dedicated testing library.

`eigen_api` is the generated transport package used inside `eigen_flutter`.
Game apps do not depend on or import it directly. For wire-level lookup, use
the [HTTP API reference](./http-api/eigen-engine-api.info.mdx) or
[`openapi.json`](pathname:///openapi.json).

## Versioned docs

The `latest` link follows the newest stable package. To inspect the API for a
version pinned in an older app, open that release from the
[`eigen_flutter` versions list](https://pub.dev/packages/eigen_flutter/versions);
pub.dev keeps dartdoc for every published version.
