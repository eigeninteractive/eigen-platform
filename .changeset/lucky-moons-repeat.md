---
"create-eigen-game": minor
---

Pair scaffolded projects with the current Flutter client, and release
independently of the engine

Generated apps now install `eigen_flutter@^0.2.0` rather than `^0.1.0`, so the
two halves of a new project speak the same engine. `pnpm install` in the
generated server also no longer fails on pnpm's ignored-build-scripts check.

`create-eigen-game` has left the `fixed` changesets group and versions on its
own from here, so a scaffolder fix no longer moves the engine packages onto a
new version line. The engine range it emits now comes from the engine version
its templates were compiled against rather than from its own version number,
which is what made that group membership load-bearing.
