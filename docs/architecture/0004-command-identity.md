# 0004: mutation identity and canonical requests

- Status: accepted
- Date: 2026-08-13
- Amended: 2026-08-14, to store the canonical request instead of a digest of it
  and to say that identity-less system commands carry no receipt

## Decision

All state-changing operations require a client-created command ID. UUIDv7 is
recommended for sortable diagnostics, but identity semantics require only a
valid UUID with enough entropy. A logical user intent owns one ID across process
restarts, timeouts, network changes, and retries.

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
| committed | different | `409 commandConflict`; emit a security/defect metric |

Only committed commands are recorded, so there is no `processing` state to
resolve: a receipt exists exactly when its mutation committed, because the two
share one transaction. A future durable `processing` state would need a
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

The Durable Object half is implemented: receipts keyed by principal and id,
canonical requests, `commandConflict`, and retention through both finish and
cancel compaction. Still open, in this order:

- API: make `commandId` required and remove the server-minted fallback. Until
  then a caller that omits one gets a fresh id per attempt and no idempotency,
  so the receipts are latent rather than load-bearing.
- D1: command receipts for D1-authoritative creates, which is what makes a
  duplicate create return the same game rather than a second game.
- Client: a durable command journal, ids minted before first dispatch, and
  outcome-certainty classification.
- Only then: bounded same-id retry of retryable Worker-to-DO faults.

The DO's storage change is a clean pre-production break with no compatibility
window: there are no deployed games, so the `commands` table was redefined in
the initial migration rather than migrated forward. Local development data from
before the change must be discarded (`rm -rf .wrangler`), which is why this is
recorded here rather than treated as an ordinary migration.
