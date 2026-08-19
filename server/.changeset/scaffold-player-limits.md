---
"create-eigen-game": minor
---

Scaffold a game that declares its own seat range, against the 0.5 engine.

A generated project now implements `playerLimits` on both sides of the twin —
`templates/worker/src/module/v1.ts` and the app overlay's
`lib/game/v1/rules.dart.template` — and its `game-contract.json` and counter
fixtures are regenerated to match. The Dart overlay also stops passing
`GameCreationSpec.minPlayers`/`maxPlayers`, which no longer exist.

The emitted engine range moves with it. The scaffolder emits a caret range built
from its own `@eigeninteractive/server` devDependency, which is the version CI
typechecked the templates against, so this release is what pairs the new
templates with the engine that has the hook they implement. Without it, npm would
keep serving templates typechecked against 0.4.x alongside an engine line that
requires `playerLimits` of every `GameRules`.
