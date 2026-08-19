---
"@eigeninteractive/rules": minor
"@eigeninteractive/testkit": minor
---

Enforce the portable schema profile when emitting a game contract.

`@eigeninteractive/rules` exports `portableSchemaViolations` / `assertPortableSchema`,
and `eigen-contract` now runs them on every emitted payload. A schema outside the
profile fails the build with a JSON pointer per violation instead of emitting a
document the Dart generator cannot honour.

**This was not a style rule.** Nothing checked before, and the RPS example violated
the profile in 17 places — one of them a real defect. `z.tuple([Move, Move])` emits
`{"type": "array", "prefixItems": [Move, Move]}`, and `prefixItems` constrains only
the listed positions without bounding the length, so the emitted contract validated
a three-element array that Zod itself rejects. A Dart validator generated from it
would have been weaker than the server. Use `z.array(x).length(n)`, which emits
`items` with `minItems`/`maxItems`.

**Breaking for game authors** whose schemas use `z.tuple` or a `z.union` of
literals: the contract build now fails and names the pointer. `.nullable()` is
unaffected — `anyOf: [T, {"type": "null"}]` is the one `anyOf` shape the profile
accepts, since it is what every library emits for nullability and is equivalent to
the `[T, "null"]` type union the profile already allowed.

**Contracts now emit the output direction of all four schemas.** Action used the
input direction, and Zod omits `additionalProperties: false` there — so the one
payload clients submit was described as open. Committed `game-contract.json` files
need regenerating; schemas are required to be transform-free, so nothing else about
them changes.

**Fixed:** the emitter sorted object keys with `localeCompare` while
`tool/check-contracts.mjs` sorted by code point, as RFC 8785 requires. Generated
JSON Schema is full of capitalized `$defs` names, so the two orders genuinely
disagreed — `Move` before `additionalProperties` under one rule and after it under
the other. Any digest computed over one would never have matched a document written
by the other. Both now sort by code point.

**Removed:** `contracts/protocol/v1/`. Four hand-written wire schemas that nothing
generated from or validated against, all four drifted from the shipped protocol.
The wire is the Zod schemas published as generated OpenAPI 3.1, which is JSON
Schema; `Session` and `Frame` are in that document, so the socket payload was
already normative.
