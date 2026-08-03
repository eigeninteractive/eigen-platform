---
"create-eigen-game": minor
---

Resolve the Flutter client from pub.dev instead of a pinned literal

`create-eigen-game` now asks pub.dev for the newest `eigen_flutter` whose own
`eigen_api` constraint targets the engine line it is scaffolding, rather than
emitting a hardcoded range. A literal could only be corrected by publishing this
package, and every scaffolder already on npm kept emitting whatever was baked
into it — so the server and app halves drifted apart in versions nobody could
reach.

Scaffolding now requires network access and fails immediately without it, before
anything is written. There is no fallback pin: a stale pin that still resolves
produces a project whose two halves quietly disagree, which surfaces much later
as a decode failure against a running server.

`scaffoldGame` is now `async` and takes an optional `fetchJson` seam.
