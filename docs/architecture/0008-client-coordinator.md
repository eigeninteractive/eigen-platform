# 0008: serialized client coordinator

- Status: accepted
- Date: 2026-08-13

## Decision

Each opened game has one pure-Dart coordinator. HTTP command results, WebSocket
sessions, canonical recovery reads, persisted cache, auth/seat changes, and
local command state are messages in one serialized queue. Repositories and UI
providers do not independently mutate the visible session.

The coordinator depends on ports for transport, clock, persistence, IDs, and
connectivity. It has no Flutter, Riverpod, Firebase, navigation, analytics, or
widget dependency.

## Durable model

The persisted per-game record contains:

- exact contract ID and protocol major;
- last complete session plus authoritative game version;
- connection generation and last accepted stream sequence for diagnostics;
- pending commands with stable ID, semantic payload, attempt count, and outcome
  certainty; and
- cache policy/expiry and last successful server time sample.

Tokens are held by the auth port and are never persisted in this record.

## Session state machine

| Current | Event | Guard | Next | Effect |
| --- | --- | --- | --- | --- |
| `cold` | cache loaded | contract supported, unexpired | `stale` or `terminal` | render labelled cached session |
| any nonterminal | canonical session | newer/equal canonical version | `synced` | atomically replace complete session |
| `synced` | stream session | next `streamSeq`, nondecreasing game version | `synced` | apply complete session |
| `synced` | stream gap | sequence skipped | `recovering` | pause stream application; fetch canonical session |
| `recovering` | recovery success | contract supported | `synced`/`terminal` | atomically rebase stream generation |
| nonterminal | terminal session | authoritative | `terminal` | apply and close mutation controls |
| `terminal` | active session | any version | `terminal` | ignore and record invariant metric |
| `terminal` | newer terminal enrichment | same game/contract | `terminal` | replace atomically |
| any | unsupported contract/feature | exact check fails | `updateRequired` | stop decoding/mutating; preserve raw metadata only |
| any online | auth permanently lost | principal/seat invalid | `accessLost` | resolve controls; keep permitted cached view |
| any | unrecoverable protocol violation | validated | `fatal` | retain diagnostics and explicit retry/reset action |

No frame or snapshot is partially applied. Recovery validates the requested
range/count/order before enqueueing one atomic replacement.

## Command state machine

| Current | Event | Next | Rule |
| --- | --- | --- | --- |
| none | user intent | `persisting` | allocate ID and persist before network |
| `persisting` | durable write succeeds | `sending` | dispatch exact stored semantic payload |
| `sending` | committed response/session ack | `committed` | feed canonical session through session reducer |
| `sending` | proved rejection | `rejected` | surface typed problem and unlock controls |
| `sending` | timeout/disconnect after dispatch | `unknown` | retain ID; retry/query status by policy |
| `unknown` | retry timer/connectivity | `sending` | same ID and payload only |
| `unknown` | canonical committed result | `committed` | converge exactly once |
| `unknown` | authority proves absent/rejected | `rejected` | new user intent may allocate a new ID |
| nonfinal | seat/auth disappears before send | `rejected` or `unknown` | resolve immediately according to dispatch boundary |

UI disablement derives from command state; it is not an independently toggled
boolean. Every exit path emits a final or unknown state.

## Ordering rules

Authoritative game version orders game state. Connection-local `streamSeq`
detects loss but does not order across reconnects. Source priority does not
exist: an HTTP response is not privileged over a later queued socket message;
both pass the same version/lifecycle checks. Cache is always labelled stale
until confirmed during the current auth/contract context.

## Offline behavior

Previously fetched, unexpired sessions may render read-only with clear stale
status. vNext does not queue new game mutations offline by default; a product
that enables it uses the same durable command model and must define abandonment,
expiry, and conflict UX. Reconnect never silently discards an unknown command.

## Package boundary

The coordinator and its tests live in a pure Dart package. Flutter exposes
providers/listenables and typed presentation state. Firebase supplies optional
auth/messaging adapters. The full shell consumes these public adapters exactly
as a third-party app would.
