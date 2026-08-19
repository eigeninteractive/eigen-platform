---
"create-eigen-game": patch
---

Raise the scaffolded Flutter shell to `eigen_flutter ^0.7.0`, so both halves of a
new project speak the same wire.

0.12.0 shipped pairing a `^0.5.0` worker with a 0.6.0 shell, which resolves
`eigen_api` 0.4.1 -- the 0.4.x wire. That project does not work and does not even
compile: the 0.5 contract renamed `clientSchemaVersion` to
`clientSchemaVersions` and requires `Idempotency-Key`, and the app overlay's
generated `rules.dart` implements `playerLimits` returning a `PlayerLimits`,
which does not exist before `eigen_flutter` 0.7.0.

This could not have been fixed in the release that caused it. The floor names a
published `eigen_flutter`, and `eigen_flutter` publishes at the end of the
release chain, after the npm packages the scaffolder ships beside -- so when the
engine crossed to 0.5.x there was no 0.7.0 to point at yet. A Flutter line move
costs a follow-up scaffolder patch, and `scripts/scaffold-e2e.mjs` is what
refuses to let it be forgotten: it resolves both halves against the real
registries and compares the wire lines they land on.
