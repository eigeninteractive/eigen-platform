# 0006: portable JSON Schema profile

- Status: accepted
- Date: 2026-08-13

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
