# 0004: mutation identity and canonical requests

- Status: accepted
- Date: 2026-08-13
- Amended: 2026-08-14, to store the canonical request instead of a digest of it,
  to say that identity-less system commands carry no receipt, and to carry the
  command id in the standard `Idempotency-Key` header

## Decision

All state-changing operations require a client-created command ID, carried in the
`Idempotency-Key` request header defined by the IETF header field of that name.
The header is the transport; `commandId` is what the engine stores it as.

The value is opaque and length-bounded. UUIDv7 is recommended for sortable
diagnostics, but the authority has no reason to demand a particular format: a
receipt is scoped to the caller's principal, so a caller who chooses a repeated
or guessable key can only collide with themselves. A logical user intent owns one
ID across process restarts, timeouts, network changes, and retries.

Requiring it uniformly, including on operations that do not yet honour it, is
deliberate: a client should never have to know which mutations deduplicate.

The authority binds that ID to a canonical request:

```text
JCS({
  version: 1,
  principal: immutablePrincipalId,
  operation: stableOperationName,
  resource: canonicalResourceId,
  payload: semanticPayload
})
```

JCS is the JSON Canonicalization Scheme in RFC 8785, applied through that RFC's
reference implementation rather than a local one. Tokens, display names, headers,
timestamps sampled by the host, transport metadata, and default values that do
not change intent are excluded. Defaults are normalized first, so an omitted and
an explicitly defaulted request cannot acquire different meanings.

The canonical request is stored and compared verbatim. An earlier draft of this
record hashed it with SHA-256; that saved a small number of bytes beside a
receipt already holding a whole session snapshot, in exchange for a digest await
inside the authority's read-then-write critical section and a collision case to
argue about. An implementation MAY hash instead where request payloads are
genuinely large, but MUST then record the digest algorithm alongside it.

`resource` is the id the AUTHORITY owns, never the one the caller supplied. A
receipt may not name a resource its authority is not authoritative for, whatever
routing did.

## Authoritative behavior

The deduplication record and mutation commit share the authoritative
transaction. Its logical fields are:

| Field | Purpose |
| --- | --- |
| `principalId`, `commandId` | authorization-scoped primary identity |
| `request` | immutable collision proof: the canonical request above |
| `response` | canonical replayable outcome |
| `createdAt` | audit and safe retention |

For game mutations this record lives in the game's SQLite Durable Object and is
written with the transition. For create-account/game operations whose authority
is D1, a D1 receipt is written in the same transaction as the authoritative row.
No cross-store pseudo-transaction is used.

A record exists only for a command a principal submitted. An identity-less
system command, one the engine derives from committed state such as a deadline
timeout, writes no receipt: it is idempotent because the authority abstains once
the state it was derived from has moved on. That is a stronger guarantee than a
stored result, because it survives a lost schedule, a replaced object and a
redeployment, and it costs no permanent row per turn.

## Decision table

| Existing record | Canonical request | Behavior |
| --- | --- | --- |
| none | any valid | execute once and persist canonical outcome atomically |
| committed | equal | return stored outcome without executing hooks or effects |
| committed | different | `422 commandConflict`; emit a security/defect metric |
| no key sent | n/a | `400 idempotencyKeyInvalid` |

The 422 follows the `Idempotency-Key` specification, and it also keeps 409
honest: every other 409 in this API means "your view is stale, resync and retry",
which is exactly what a caller must not do with a reused key.

Only committed commands are recorded, so there is no `processing` state to
resolve: a receipt exists exactly when its mutation committed, because the two
share one transaction. The specification's `409` "a request is outstanding for
this key" therefore has no counterpart here, and needs none: the authority
serializes its commands, so a duplicate arriving while the first is in flight
waits and then reads the committed receipt. A future durable `processing` state would need a
narrow justification, and a future expiry policy would add an `expired`
tombstone row that rejects as `commandExpired` rather than risking treating an
ancient retry as new.

Rejected validation/auth/rate-limit attempts stay outside the durable table,
since non-commitment is certain and re-evaluating a refusal is always sound. A
payload that fails validation therefore needs no identity at all: nothing
committed, so no id can collide with it. Once authoritative execution begins, an
ambiguous failure must be resolvable by the same command ID.

## Client rules

The pure Dart coordinator persists the command ID and canonical semantic input
before first dispatch. It may retry automatically only when policy permits and
always with the same ID. Changing payload creates a new intent and a new ID.
Sign-out or seat loss does not relabel an unknown outcome as failed.

## Retention

Command records are retained with their authoritative resource. In particular,
a game's command records and canonical outcomes remain available for the life
of the game, which RFC 0007 defines as indefinite at vNext launch. This is both
simpler and safer than guessing an expiry window after which an ancient retry
could become a new mutation.

If a future accepted retention policy expires or compacts full command
outcomes, it MUST leave a tombstone containing `principalId`, `commandId`, the
canonical request or a digest of it, and the policy boundary for at least every supported retry and
offline-queue window. That policy change must define how a retry after the
boundary fails; it may not silently become a new command.

## Delivery

Implemented:

- The Durable Object half: receipts keyed by principal and id, canonical
  requests, `commandConflict`, and retention through both finish and cancel
  compaction.
- The API half: `Idempotency-Key` is required on every game mutation, with no
  server-minted fallback. The fallback gave every attempt a fresh identity, which
  made the receipts latent rather than load-bearing.
- The D1 half: a create reservation keyed by `(principal_id, command_id)`,
  written in the same batch as the `games` row, so a retried create returns the
  game it already made instead of a second one. Create-solo is two operations
  under one key: the reservation replays the create, and the start is re-issued
  under an id *derived* from that key, which also resumes a create whose process
  died before the start landed. Reservations are pruned by the cron backstop;
  they only have to outlive a retry of their own create.
- The client half's outcome classification: `engineCall` distinguishes a server
  decision (an `EngineException` carrying a stable code) from an unknown outcome
  (a transport failure with no response), and the transport retry replays the
  original request, so a retried mutation reuses its key by construction.

Still open:

- Bounded same-id retry of retryable Worker-to-DO faults.

**Not building: a durable client command journal.** Ids are minted per intent
and live as long as the request. Persisting them to survive a restart was
specified, and is the standard pattern (Replicache's mutation ids, PowerSync's
CRUD queue, Brick's offline queue), but it buys little here: a game action
carries a deadline the kernel refuses once passed, so a replayed stale action
mostly defers a rejection; the board is authoritative and visible on reconnect,
so "did my move land?" is answered by looking rather than by bookkeeping; and
duplicate suppression already lives on the server. Revisit when there is an
intent with no deadline whose loss a player would notice — creating or joining
over a flaky connection is the realistic trigger. Doing so also means raising
the create-reservation TTL, since a journal can retry long after the window an
in-request retry needs.

The DO's storage change is a clean pre-production break with no compatibility
window: there are no deployed games, so the `commands` table was redefined in
the initial migration rather than migrated forward. Local development data from
before the change must be discarded (`rm -rf .wrangler`), which is why this is
recorded here rather than treated as an ordinary migration.
