# 0006: portable JSON Schema profile

- Status: accepted
- Date: 2026-08-13
- Amended: 2026-08-19. The profile is now enforced at emission, and two rules
  changed to match what schema libraries actually emit. See "Implementation
  notes" at the end.

## Decision

Game payload schemas use a deliberately small JSON Schema 2020-12 profile that
can be validated equivalently in TypeScript and generated Dart. Unsupported
semantics fail contract generation with a JSON pointer and explanation. The
generator never silently weakens a constraint.

## Allowed profile

| Area | Allowed |
| --- | --- |
| Scalars | `type`, `const`, `enum`; explicit `null` in a type union |
| Numbers | `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf` |
| Strings | `minLength`, `maxLength`, ECMA-262-compatible `pattern` |
| Arrays | `items`, `minItems`, `maxItems`, `uniqueItems` |
| Objects | `properties`, `required`, `additionalProperties: false`, `minProperties`, `maxProperties` |
| Composition | `oneOf` only for a required string discriminator whose branches use distinct `const` values |
| Reuse | local `#/$defs/...` references and `$defs` |
| Annotation | `title`, `description`, `deprecated`, `examples` |

Every object schema MUST explicitly use `additionalProperties: false`. Numbers
mapped to Dart `int` MUST be integers within the interoperable safe integer
range. Defaults are documentation only and are normalized by authoritative code;
validators do not mutate input by applying them.

## Initially forbidden

- remote, recursive, dynamic, or cyclic references;
- `anyOf`, `allOf`, `not`, `if/then/else`, dependent schemas, and property-name
  schemas;
- tuples/prefix items and unevaluated keywords;
- content encodings, custom formats, coercion, NaN, Infinity, bigint, binary,
  maps with arbitrary keys, or non-string JSON object keys;
- regular-expression features not supported equivalently by JavaScript and Dart.

A forbidden keyword is a build error even when a particular generator happens
to ignore it harmlessly today.

## Generated output requirements

For config, state, action, and observation, generation emits:

1. immutable typed Dart values with value equality;
2. JSON parser/serializer preserving wire names;
3. validation that enforces every accepted profile keyword;
4. discriminated unions with an explicit unknown-contract failure;
5. TypeScript schema conformance tests and Dart boundary fixtures; and
6. generator/profile version plus exact contract digest in the file header.

Tests cover each constraint at below/equal/above boundaries and malformed
nested paths. A kitchen-sink golden contract exercises every allowed keyword.

## Canonicalization

Schema identity uses parsed JSON, not author formatting. Object keys are
canonicalized by RFC 8785. Arrays retain semantic order except fields declared
as sets by the contract format, which are normalized and sorted before digest.
Descriptions and other accepted annotations are included: changing generated
developer-facing meaning intentionally changes the exact contract.

## Evolution

Adding a schema feature requires equivalent TypeScript and Dart validation,
code generation, fixtures, canonicalization rules, and documentation in one
change. The profile version then increments when older generators cannot safely
interpret the new manifest.

## Implementation notes (2026-08-19)

**The profile is enforced now; it was not before.** One implementation lives in
`@eigeninteractive/rules` (`portable-schema.ts`), the contract emitter runs it on
every emitted payload, and `tool/check-contracts.mjs` imports the same function
rather than restating it. Before this, nothing checked, and the shipped RPS example
violated the profile in 17 places.

**One of those violations was a real soundness defect, not a style problem.**
`z.tuple([Move, Move])` emits `{"type": "array", "prefixItems": [Move, Move]}`.
`prefixItems` constrains only the listed positions and does not bound the length,
so the emitted contract validated a three-element array that Zod itself rejects. A
Dart validator generated from that document would have been **weaker than the
server** — the exact failure this profile exists to prevent. `prefixItems` stays
forbidden; `z.array(x).length(n)` emits `items` with `minItems`/`maxItems` and says
what was meant. A heterogeneous tuple still has no portable spelling and now fails
the build instead of emitting a lie.

**`anyOf` is admitted in exactly one shape.** This record allowed nullability as
`type: [T, "null"]` and forbade `anyOf` outright. Zod cannot emit the former: every
`.nullable()` becomes `anyOf: [T, {"type": "null"}]`, and nullability is
unavoidable in game state. The profile now accepts `anyOf` with exactly two
branches, one of them `{"type": "null"}` — semantically identical to the union it
already allowed. General `anyOf` remains forbidden: overlapping branches have no
single Dart type and no discriminator to generate a parser from. The Dart payload
generator independently only ever handled this one shape, which is corroboration
rather than coincidence.

**Contracts emit the output direction of every schema.** Action previously used the
input direction, and Zod's input schema omits `additionalProperties: false` — so the
one payload clients submit was the one described as open. Schemas are required to be
transform-free, so the two directions describe the same values and the output one is
simply the honest document.

**Known gap: the Dart generator does not enforce value constraints.** Generated
output requirement 3 above ("validation that enforces every accepted profile
keyword") is not met. The generator enforces types, enums, `required`, and
nullability; it ignores `minItems`, `maxItems`, `minimum`, `maximum`, `pattern`,
`minLength`, `multipleOf`, and `uniqueItems`. So a fixed-length array is now
*described* correctly and still not *checked* client-side. That is a strictly
smaller hole than before — the server remains authoritative and rejects the
payload — but it is the next piece of this RFC to build, together with the
below/equal/above boundary tests this record already specifies.
