# 0003: protocol envelopes, errors, and capabilities

- Status: accepted, partly superseded
- Date: 2026-08-13
- Amended: 2026-08-14. The version-axes and capability rules below are
  implemented. Three other parts are superseded by narrower decisions taken while
  building them, recorded in "Implementation notes" at the end: the HTTP command
  envelope, the `outcome`/`retryable` fields, and feature-token negotiation.

## Version axes

Package SemVer, protocol compatibility, game contracts, storage migrations, and
platform releases are independent axes. A package bump does not imply a wire
break. A game schema integer does not imply support for every lower integer.

vNext begins at protocol major `1`. Within a major, optional behavior is named
by registered feature tokens. A participant is compatible only when:

1. protocol majors are equal;
2. it has every feature required for the operation; and
3. it advertises the exact game contract ID selected by the server.

No comparison using `<= latestVersion` is valid capability negotiation.

## Client capability manifest

Clients send a capability manifest during session establishment and game
creation/join. Feature and contract arrays
are sets: sorted for canonicalization and free of duplicates.

Unknown optional server features are ignored. An unknown required feature or
contract yields `clientUpdateRequired` before seating or mutating game state.

## HTTP command envelope

Every mutation body has:

- `commandId`: stable UUID supplied by the logical caller;
- `operation`: registered stable operation name, independent of route spelling;
- `payload`: operation-specific semantic input.

Authorization and resource identity come from the authenticated route context,
not caller-controlled fingerprint fields. RFC 0004 defines deduplication.

A successful response includes `requestId`, `commandId`, and a canonical result.
Errors use a typed problem shape. HTTP status remains useful for intermediaries;
`code`, `outcome`, and `retryable` carry engine semantics.

## Error and retry table

| Outcome | Meaning | Retry with same command ID | New command ID |
| --- | --- | --- | --- |
| `notCommitted` | Authority proved the command did not commit | Allowed when `retryable`; usually unnecessary for validation/auth errors | Allowed only after changing intent |
| `committed` | Authority committed and returns/references its canonical result | Safe; returns the same result | Creates a distinct command and is normally wrong |
| `unknown` | Client cannot know whether commit happened | Required after retry/backoff or status read | Forbidden until resolved or explicitly abandoned |

| Example | HTTP | Code | Outcome | Client action |
| --- | ---: | --- | --- | --- |
| Invalid payload | 422 | `invalidInput` | `notCommitted` | Correct input; new ID for changed intent |
| Unsupported contract | 409 | `clientUpdateRequired` | `notCommitted` | Update client; do not retry blindly |
| Command ID reused differently | 409 | `commandConflict` | `notCommitted` | Defect/operator signal; never change ID silently |
| Busy before dispatch | 503 | `temporarilyUnavailable` | `notCommitted` | Retry same ID after `retryAfterMs` |
| Transport timeout | none | local `transportUnknown` | `unknown` | Retry same ID or query command status |
| Duplicate committed command | 200/operation status | none | `committed` | Consume canonical result |
| Rate limited | 429 | `rateLimited` | `notCommitted` | Retry same ID after `Retry-After` if intent remains |

Every error observed after authoritative dispatch MUST conservatively use
`unknown` unless the authority proves non-commitment.

## Server stream

WebSockets are server-to-client notification streams after a short-lived,
single-use socket ticket is exchanged. Long-lived bearer tokens MUST NOT appear
in the URL.

The server emits a session event carrying:

- a monotonically increasing connection-local `streamSeq`;
- exact `contractId` and authoritative game `version`;
- a complete per-seat session snapshot; and
- optional acknowledgement metadata for a committed command.

The client sends no game mutations over this connection. A sequence gap causes
a canonical session read and stream rebase; it never causes partial event replay
into UI state. Reconnect is normal and carries no correctness assumption.

## Compatibility rollout examples

### Additive feature

The server implements `public-replay-v1` but does not require it for ordinary
play. Old clients continue. A replay entry point is shown only to manifests that
advertise it.

### Breaking game contract

`chess/v2/<digest>` and `chess/v4/<digest>` may coexist while v3 is retired. A
client listing only v4 cannot join a v2 game. New creation selects from the
intersection of server-create-enabled and client-advertised exact IDs.

### Protocol major migration

A server MAY temporarily serve majors 1 and 2 through explicit handlers. It
never parses a major-2 envelope as major 1. Retirement is an observed rollout
decision recorded in the platform manifest and operator metrics.

## Implementation notes (2026-08-14)

What shipped, and what this record got wrong.

**Exact membership shipped as integer version sets.** Join sends every
`schemaVersion` the client build ships and the server tests membership before
seating. `No comparison using <= latestVersion is valid capability negotiation`
was the correct and load-bearing conclusion; the defect it names was real.

**Contract IDs with digests did not ship.** The soundness fix needs only exact
membership, which integers provide. A digest additionally detects "same version
integer, different rules", which is a real but separate hazard, and it requires a
generated per-version manifest that both languages consume. Two contract formats
currently exist — the generated `game-contract.json` that feeds the Dart generator
(no `contractId`, all versions in one file) and the normative
`contracts/game/v1/game-contract.schema.json` (per-version, digested, with a
`creation` policy, and no producer). Reconciling those is the real prerequisite,
and is not scheduled.

**Creation is the highest version, not an intersection.** This record says
creation "selects from the intersection of server-create-enabled and
client-advertised exact IDs". Implemented and then removed: it required the client
to fetch capabilities, intersect, pick a version, and compute its `config` and
`rated` assertion against *that* version's rules rather than its newest — real
complexity in two dialogs — to buy a staged creation cutover. The simpler rule is
that new games use the server's newest version and a client that cannot is told to
update, which every app already knows how to do. `creatableSchemaVersions` remains
as an operator override for rollback, where creation must move back without
unshipping a version games already exist at.

**The HTTP command envelope is superseded.** `{commandId, operation, payload}` in
every body: `commandId` moved to the standard `Idempotency-Key` header (RFC 0004,
amended), and `operation` is derived server-side from the route in
`command-request.ts`. A client-supplied operation name would be a second,
forgeable source of truth for something the route already determines.

**`outcome` is not deliverable, so it is not sent.** The tri-state
`notCommitted | committed | unknown` cannot live in a response body: `unknown`
means the client could not learn whether the commit happened, which is exactly the
case where no body arrives. The other two values restate the status and `code`.
The client derives all three correctly at the transport boundary instead — a
response present means the server decided, a response absent means unknown.

**No feature tokens.** The registry would today hold only tokens true of any
client that can reach the engine at all, and the server would branch on none of
them. The mechanism is worth adding with its first genuinely optional feature, so
its semantics can be designed against a real second case.

**The `contracts/protocol/v1/` schemas are deleted, not implemented.** This record
pointed at four hand-written JSON Schemas for the capability manifest, the command
envelope, the problem shape, and the session event. Nothing ever generated from them
or validated against them, and by deletion all four disagreed with the shipped
protocol — the session event named `streamSeq`, `protocolMajor`, `contractId`, and an
opaque `session` object, where the socket actually sends the flat `Session` shape with
`seq`. The wire is defined by the Zod schemas in `routes/wire.ts` and published as
generated OpenAPI 3.1, which *is* JSON Schema; `Session` and `Frame` appear there
because they are HTTP response shapes too, so the socket payload is already
normative and machine-readable. A second description that nothing checks is worse
than none, because it gets read and believed.

**No `protocolMajor` on the wire.** Publishing a constant negotiates nothing, and
there is no major 2 to distinguish from. Adding it later is additive, and a client
that never read it behaves then exactly as it does now.
