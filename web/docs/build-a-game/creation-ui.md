---
sidebar_position: 8
title: The creation UI
description: Declaring valid player counts, timing modes and game-specific options, and why the rated flag is an assertion the server checks rather than a preference it trusts.
---

# The creation UI

Creation is version-independent, since a new game is always created at the newest
version your build ships, so it lives on the Dart `GameModule` rather than on a
`GameRules` unit. Three members, none of which you write a dialog for: the shell
renders the dialog from what you declare.

```dart
class RpsModule extends GameModule {
  const RpsModule();

  @override
  Map<int, GameRules> get versions => const {1: RpsRulesV1()};

  @override
  GameCreationSpec get creationSpec => const GameCreationSpec(
    timingConfigs: {
      'Per move': PerActionConfig(maxSeconds: 300, presets: [30, 60, 120]),
      'Untimed': UntimedConfig(),
    },
    defaultConfig: {'targetWins': 3},
  );

  @override
  Widget? buildCreationConfig({
    required ValueChanged<Map<String, dynamic>> onChanged,
  }) => _TargetWinsPicker(onChanged: onChanged);

  @override
  Widget buildRules(BuildContext context) => const RpsRulesPage();
}
```

## `creationSpec`

- **`timingConfigs` keys become segmented-button labels**, in insertion order, so
  the first entry is the default. `PerActionConfig` renders presets plus a
  slider; `BudgetConfig` adds an increment slider. Floors are enforced on both
  sides (`kMinTurnSeconds` 30 s, `kMinBudgetSeconds` 120 s).
- **`BudgetConfig` is only valid for strictly sequential games.** The server
  rejects a hook envelope with more than one pending seat in a budget-timed game
  as a game bug. If any phase has multiple pending seats, use a per-action mode
  for it, or a `turnSeconds` override on that envelope.
- **`defaultConfig`** seeds the config map before the player touches anything, so
  a game with no custom UI still creates a valid game.
- **Seat counts are not here.** They come from the versioned
  `GameRules.playerLimits` twin, because the server derives them per version and
  **refuses a create whose range it cannot seat**. Read them via
  `playersForConfig`, which delegates to the latest version's twin by default.
  Override `playersForConfig` only to *narrow* what the dialog offers; a wider
  range is a failed create, not a bigger game.

## `buildCreationConfig`

Returns a widget for game-specific options, or null if timing and player count
are the whole story. It calls `onChanged` on every edit; the dialog stores the
latest value in a plain field (not state, since it is never displayed) and
sends it with the create request at submit time.

Whatever it produces is the game's `config`, and **the server validates it
against your `configSchema`**. An out-of-range value is rejected there, so this
widget is a convenience, not a gate.

## `buildRules`

Non-scrolling how-to-play content for the About page. The page supplies the
scroll container, padding and chrome. It is free to be interactive (an animated
board example) and to read `Theme.of`.

## Two constraints from elsewhere

### Bots imply a timed game

If a game can seat a bot, its creation UI must require a turn or budget clock.
Bot dispatch is single-attempt, so the turn deadline firing the server's alarm is
the only thing that resolves a bot which never moves. The engine enforces this at
seating; declaring an untimed-only game that also allows bots just produces a
rejection later.

### `rated` is a validated assertion, not a preference

The client computes `rated` from the Dart `ratingPool` twin plus its own guest
status, and sends a **concrete value**. The server recomputes it and **rejects a
mismatch with a 422** rather than coercing.

That is deliberate: coercion would silently paper over a drifted twin or a forged
client, and the twin drifting is exactly the failure this design wants to be
loud. Keep the two `ratingPool` implementations in agreement, and let
[twin fixtures](./testing.md) prove it.
