---
"create-eigen-game": patch
---

Pair a newly scaffolded project with `eigen_flutter` 0.10.0.

The scaffolded worker already takes engine `^0.7.0`, but the app overlay still
pinned `eigen_flutter ^0.9.0`, which resolves `eigen_api` on the 0.6.x wire. A
project generated from `create-eigen-game@0.15.0` therefore gets two halves that
speak different engines, and the scaffold's own `local_rules.dart` calls
`GameRules.local`, which does not exist before 0.10.0.

This is the follow-up patch a Flutter line move structurally costs: the floor
names a *published* `eigen_flutter`, and `eigen_flutter` publishes at the end of
the release chain, after the npm packages this scaffolder ships beside, so there
is no 0.10.0 to point at until the chain has finished.
