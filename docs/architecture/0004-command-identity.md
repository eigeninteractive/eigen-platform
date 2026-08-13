# 0004: mutation identity and canonical fingerprints

- Status: accepted
- Date: 2026-08-13

## Decision

All state-changing operations require a client-created command ID. UUIDv7 is
recommended for sortable diagnostics, but identity semantics require only a
valid UUID with enough entropy. A logical user intent owns one ID across process
restarts, timeouts, network changes, and retries.

The authority binds that ID to a fingerprint:

```text
SHA-256(JCS({
  version: 1,
  principal: immutablePrincipalId,
  operation: stableOperationName,
  resource: canonicalResourceId,
  payload: semanticPayload
}))
```

JCS is the JSON Canonicalization Scheme in RFC 8785. The encoded digest is
lowercase hex. Tokens, display names, headers, timestamps sampled by the host,
transport metadata, and default values that do not change intent are excluded.
Defaults are normalized before hashing so omitted and explicitly defaulted
requests cannot acquire accidental different meanings.

## Authoritative behavior

The deduplication record and mutation commit share the authoritative
transaction. Its logical fields are:

| Field | Purpose |
| --- | --- |
| `principalId`, `commandId` | authorization-scoped primary identity |
| `operation`, `resourceId`, `fingerprintVersion`, `fingerprint` | immutable collision proof |
| `state` | `committed` or a narrowly justified durable `processing` state |
| `result` or `problem` | canonical replayable outcome |
| `committedVersion`, `createdAt` | audit and safe retention |

For game mutations this record lives in the game's SQLite Durable Object and is
written with the transition. For create-account/game operations whose authority
is D1, a D1 receipt is written in the same transaction as the authoritative row.
No cross-store pseudo-transaction is used.

## Decision table

| Existing record | Fingerprint | Behavior |
| --- | --- | --- |
| none | any valid | execute once and persist canonical outcome atomically |
| committed | equal | return stored outcome without executing hooks or effects |
| committed | different | `409 commandConflict`; emit a security/defect metric |
| processing | equal | return status/`Retry-After`, or complete recovery; never execute concurrently |
| expired tombstone | any | reject as `commandExpired`; do not risk treating it as new |

Rejected validation/auth/rate-limit attempts MAY remain outside the durable
dedupe table when non-commitment is certain. Once authoritative execution begins,
an ambiguous failure must be resolvable by the same command ID.

## Client rules

The pure Dart coordinator persists the command ID and canonical semantic input
before first dispatch. It may retry automatically only when policy permits and
always with the same ID. Changing payload creates a new intent and a new ID.
Sign-out or seat loss does not relabel an unknown outcome as failed.

## Retention

Command records must outlive every automatic/manual retry window and offline
queue lifetime. After full outcomes expire, a compact tombstone retains
`principalId`, `commandId`, fingerprint, and expiry boundary long enough to
prevent an ancient retry from becoming a new mutation. Exact periods are part
of RFC 0007's retention decision.

## Migration sketch

- DO: extend `commands` with principal, operation, resource, fingerprint
  version/hash, canonical result/problem, commit version, and expiry.
- D1: add command receipts for D1-authoritative creates/deletes.
- API: make `commandId` required and remove optional request-ID call paths.
- Client: migrate pending operations to a versioned queue; discard no unknown
  command without an explicit abandon action.
