---
"@eigeninteractive/testkit": minor
---

Add four twin-fixture kinds for offline play: `initialState`, `lifecycle`, and
`transcript` (a whole match replayed through the real kernel `commit()`) check
a version's rules the same way the Dart local unit has to reproduce them, and
`rng` records raw `deriveRng` draws for a Dart RNG port to match bit for bit.
`rngFixtureCase` and `writeRngFixture` generate `rng` fixtures directly from
the TypeScript kernel rather than by hand, since their values have to be the
kernel's own.
