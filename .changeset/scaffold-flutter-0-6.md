---
"create-eigen-game": minor
---

Install `eigen_flutter@^0.6.0` into the app half, matching the engine's 0.4.x line.

This is a required pairing rather than an improvement. The 0.4.x engine takes
`cursor` as an opaque string and returns `nextCursor` on every paged response,
and `eigen_flutter` 0.6.0 is the first shell that pins `eigen_api: ^0.4.0` and
can read it. Everything below pins `eigen_api: ^0.3.0` or older, so a scaffold
left on `^0.4.1` installed the engine's current line beside a shell that could
not read a single paged list from it: it resolved, it compiled, and then the
lobby and the history screen were empty. 0.5.0 is skipped for the same reason,
being a web-design release that still speaks the 0.3.x wire.

Closes the window opened by the engine's own 0.4.0 release: because
`updateInternalDependencies` republishes this package whenever the engine
version moves, the scaffolder had already gone out pairing a 0.4.x worker with a
0.4.1 shell.
