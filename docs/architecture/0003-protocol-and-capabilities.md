# 0003: protocol envelopes, errors, and capabilities

- Status: accepted
- Date: 2026-08-13

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

Clients send the shape in
[`client-capabilities.schema.json`](../../contracts/protocol/v1/client-capabilities.schema.json)
during session establishment and game creation/join. Feature and contract arrays
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
Errors use the problem shape in
[`problem.schema.json`](../../contracts/protocol/v1/problem.schema.json).
HTTP status remains useful for intermediaries; `code`, `outcome`, and
`retryable` carry engine semantics.

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

The server emits the shape in
[`session-event.schema.json`](../../contracts/protocol/v1/session-event.schema.json):

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
