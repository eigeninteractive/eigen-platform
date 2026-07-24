---
sidebar_position: 5
title: Building a game's client half
description: The Dart GameRules twin, GameContentContext, the creation UI, and the twin-drift fixtures that keep both halves honest.
---

# The two containers

A game ships two same-shaped registries, one per language:

- a **TypeScript `GameModule`** — `GameRules` units keyed by `schema_version`,
  each bundling the payload schemas and the authoritative hooks;
- a **Dart `GameModule`** — the same keys, client units (payload codec,
  legality, optimistic preview, rendering) plus the version-independent
  creation/about UI.

**A version is a self-contained unit and the framework owns all dispatch.** Every
screen resolves the game's `schema_version` and uses that unit; game code never
branches on version. Shipping a breaking change means adding a `v2` unit on both
sides (reusing unchanged pieces by import), not editing `v1`.

| Member | TS `GameRules` | Dart `GameRules` |
|---|---|---|
| `initialState`, `applyAction`, `applyLifecycle`, `computeObservation` | ✅ authoritative | — (the client consumes observations) |
| `schemas` (payload contracts) | ✅ | ✅ as the codec: `parseConfig` / `parseObservation` / `parseAction` / `serializeAction` |
| `isValidAction` | — (`applyAction` *is* the check) | ✅ UX-only transcription of its legality half |
| `previewAction` | — (`applyAction` is the truth) | ✅ required; the game's own optimistic projection (null ⇒ server-driven) |
| `ratingPool`, `botSeatable` | ✅ enforced | ✅ display-only twin — keep in sync |
| `buildContent` | — | ✅ client-only |
| `botActions` (bot brains) | ✅ server-side | — (**client-side local bots are deleted**) |

Every "keep in sync" is enforceable, not aspirational: shared JSON fixtures run
against both units and fail a test on divergence.

## The Dart `GameRules` unit

```dart
class MyGameRulesV1
    extends GameRules<ObservationData, ActionData, GameConfigData> {
  const MyGameRulesV1();

  // Codec — the Freezed mirror of the TS unit's schemas.
  @override GameConfigData parseConfig(Map<String, dynamic> j) => GameConfigData.fromJson(j);
  @override ObservationData parseObservation(Map<String, dynamic> j) => ObservationData.fromJson(j);
  @override ActionData parseAction(Map<String, dynamic> j) => ActionData.fromJson(j);
  @override Map<String, dynamic> serializeAction(ActionData a) => a.toJson();

  // Legality — the transcribed legality half of the TS applyAction.
  @override
  bool isValidAction({
    required ObservationData obs,
    required List<int> pending,
    required ActionData data,
    required int playerIndex,
    required GameConfigData config,
  }) => /* boundary / occupancy / ownership checks only */ true;

  // Optimism — or null to stay server-driven.
  @override
  ObservationData? previewAction({ /* same parameters */ }) => null;

  @override
  Widget buildContent(GameContentContext context) =>
      MyGameContent(rules: this, content: context);

  // Display-only twins of the TS predicates.
  @override String? ratingPool(RatingPoolArgs args) => null;
  @override bool botSeatable(BotSeatableArgs args) => true;
}
```

Notes that are easy to get wrong:

- **Do not re-check whose turn it is** in `isValidAction` for the sequential
  case — the caller has already gated on `pending`. Check *move* legality.
  Games with interrupt actions (a "Nope" window) use `pending` to tell a
  main-turn action from an interrupt.
- **`playerIndex` is passed to every game** even when unused, so the contract
  stays uniform. Chess needs it (piece ownership); tic-tac-toe doesn't.
- **The rules unit carries no player metadata.** Player counts are declared on
  `GameCreationSpec`; identities arrive via `PlayersContext`.
- **Turn-gating, game-over and winner derivation are infra facts**, surfaced via
  `frame.pendingPlayers`, `gameStatus`, and `outcomes`. Never re-derive them.
- **Infra hands widgets no rules access.** The unit passes `this` (or just the
  members a widget needs) into the content widget it builds, so the dependency
  stays explicit.

### `GameContentContext` — what `buildContent` receives

One object rather than a long parameter list, so adding infra data later never
breaks every game's signature.

| Member | Meaning |
|---|---|
| `config` | The parsed config, immutable for the whole game. Cast to your type. |
| `frame` | The per-event snapshot: `observation`, `pendingPlayers`, `version`, `timing`. |
| `gameStatus`, `outcomes` | Lifecycle status; per-seat results (empty until finished). |
| `actionPending` | True while a submit awaits its confirming frame — disable input on it. |
| `onAction(json)` | Submits a move; returns `Future<ActionSubmitResult>`. Never throws — infra has already surfaced any error. |
| `onInvalidAction()` | Call when `isValidAction` rejects a tap. **Infra owns the haptic** — never import `flutter/services.dart` to pick one yourself. |
| `playersContext` | Resolved identities; `mySeat` delegates to it. |
| `isReplay` | True when stepping a finished game frame by frame. |

During replay `gameStatus` is `finished` for every frame and `outcomes` is
populated only on the final frame, so a win banner appears at the end rather than
mid-replay. A game never *needs* `isReplay` to stay correct (the frame is a real
observation and `onAction` is inert) — it exists for replay-only presentation.

### The action payload

The engine defines **no** game-specific action type, exactly as it defines no
observation type. You own the shape, in three places that must agree: the human
tap, the server bot's JSON, and the TS `applyAction` that consumes it. Keep it
minimal — it is *only* "what the move is". Infra supplies the seat, version, RNG,
and config as separate inputs, so never put them in the payload.

`serializeAction` is the **single** place a typed action becomes JSON, which is
what keeps the producers from drifting.

## Creation UI — `GameModule`

```dart
class MyGameModule extends GameModule {
  const MyGameModule();

  @override
  Map<int, GameRules> get versions => const {1: MyGameRulesV1()};

  @override
  GameCreationSpec get creationSpec => const GameCreationSpec(
    minPlayers: 2,
    maxPlayers: 2,
    timingConfigs: {
      'Untimed': UntimedConfig(),
      'Rapid': PerActionConfig(minSeconds: 60, maxSeconds: 600,
                               presets: [60, 120, 300, 600]),
    },
  );

  @override
  Widget? buildCreationConfig({required ValueChanged<Map<String, dynamic>> onChanged}) => null;

  @override
  Widget buildRules(BuildContext context) => const MyGameRulesPage();
}
```

- **`versions` keys are sparse.** `supportsSchema` is key membership, not
  `<= latest`, so a drained-and-retired old version is correctly unsupported.
  New games are created at `latestSchemaVersion`.
- **`timingConfigs` keys become segmented-button labels**, in insertion order.
  `PerActionConfig` renders presets + a slider; `BudgetConfig` adds an increment
  slider. Floors are enforced on both sides (`kMinTurnSeconds` 30 s,
  `kMinBudgetSeconds` 120 s).
- **`BudgetConfig` is only valid for strictly sequential games** — the server
  rejects a hook envelope with more than one pending seat in a budget-timed game
  as a game bug. If any phase has multiple pending seats, use a per-action mode
  (or a hook `turn_seconds` override) for it.
- **`playersForConfig`** overrides the range when it depends on a creation-time
  choice (a party game where the host picks 4 or 6 and min == max).
- **`buildCreationConfig`** returns a widget for game-specific options. It calls
  `onChanged` on every edit; the dialog stores the latest value in a plain field
  (no `setState`) and sends it at submit.
- **`buildRules`** returns non-scrolling how-to-play content — the About page
  supplies the scroll container and chrome.
- **`rated` is a validated assertion.** The client computes it from the Dart
  `ratingPool` twin plus its guest status and sends a concrete value; the server
  recomputes and **rejects a mismatch (422)** rather than coercing. That is what
  catches twin drift and forged clients, so the twins must agree.

## Testing a game's client half

**Twin-drift fixtures** are the net. One set of shared JSON fixtures per schema
version runs against *both* units — the TS runner drives `applyAction` +
`computeObservation`, the Dart runner drives the codec, `isValidAction`, and
`previewAction`. `expected.observation` is the shared behavioural anchor both
sides are compared through.

The Dart half rides `flutter test` via
`package:eigen_flutter/testing/twin_fixtures.dart`
(`loadTwinFixtureSuites` + `runTwinFixtureCase`).

Three things the fixtures are strict about:

- **Fixtures use the wire shape, not Dart field names.** With
  `field_rename: snake`, the key is `action_count`, never `actionCount` — and the
  TS schemas must use the same keys. The fixture is what pins this.
- **The Dart observation type needs value equality** for the observation
  comparison. Freezed gives it; a hand-written type must override `==`/`hashCode`.
- **Grow the suite with the rules.** Cover at minimum one legal move (with its
  expected observation), one illegal move, one game-ending move, and one case per
  `ratingPool` / `botSeatable` branch.

Beyond that, plain unit tests against the rules unit for helper logic, and the
engine's own suites for everything infra. The server side is
[Testing your game](../build-a-game/testing.md).
