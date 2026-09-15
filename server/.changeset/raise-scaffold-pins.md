---
"create-eigen-game": minor
---

Scaffold the 0.8.x engine line against the Flutter packages that speak it:
`eigen_flutter ^0.11.0` and `eigen_shell ^0.3.0`.

The wire-pairing gate in `scaffold-e2e.mjs` turned red the minute
`eigen_flutter 0.11.0` reached pub.dev constraining `eigen_api ^0.8.0`, which
is what it is for. Until a shell speaking 0.8.x existed there was nothing to
compare a `^0.10.0` pin against, and the gate said so in a notice rather than
failing; the moment one shipped, the pin became knowably stale.

`eigen_shell` moves with it rather than separately: `0.3.0` constrains
`eigen_flutter ^0.11.0`, and pre-1.0 `^0.2.0` cannot reach it.
