# 0007: replay fidelity, retention, and privacy

- Status: proposed
- Date: 2026-08-13
- Owner gate: choose the default finished-game retention duration

## Proposed decision

The authoritative log is an immutable sequence of state snapshots and actions,
not pure event sourcing. At each committed transition the game Durable Object
stores:

- authoritative state/action/cause for recovery and audit;
- the exact per-seat frames delivered for participant replay;
- zero or one explicit public replay frame when public replay is enabled; and
- protocol major, exact game contract ID, transition version, and timestamps.

Replay serves retained bytes. It does not re-run old projector code, so a future
deployment cannot change historic visibility or output.

## Privacy policy

Opaque game config/state/action/observation MUST NOT contain direct personal
data, free-form chat, access tokens, email addresses, device identifiers, or
user-authored personal content. Games refer to engine-owned principals only by
opaque IDs supplied through the roster context.

Engine-owned identity/profile data stays in D1 where export, anonymization, and
deletion are enforceable. If a real product needs personal content inside game
data, it requires a new accepted data-classification/redaction contract before
shipping; a generic JSON redactor is not assumed.

Deleting one account from a multiplayer game anonymizes its engine-owned
identity without rewriting immutable game facts or exposing another seat's
private frame. A solo game MAY be purged in full when no other principal has a
retention interest. Public replay is generated deliberately and never falls
back to a participant frame.

## Retention model

The host configures a finished-game retention duration bounded by platform-safe
minimum and maximum values. One deletion job removes transition state, private
frames, public replay, command results/tombstones when safe, D1 summaries, and
object storage consistently, with idempotent progress and operator-visible
failures.

The recommended default is deliberately left blank until the owner chooses it:

```text
finishedGameRetentionDays = OWNER_DECISION_REQUIRED
```

This is the only unresolved decision preventing this RFC from acceptance. R2
cold storage is out of scope until measured SQLite/D1 storage or access patterns
justify it.

## Export and deletion

- Export names policy version, contract ID, visibility class, and expiry.
- Participant export includes only that principal's exact frames and
  engine-owned identity data.
- Operator/debug export of authoritative opaque state is privileged, audited,
  time-bounded, and never written to routine logs.
- Retention expiry and user deletion are retryable workflows with durable
  cursors; partial deletion is visible and resumes.

## Migration sketch

- DO: retain frames after finish; add public replay frames, expiry, deletion
  state/cursor, and artifact contract/protocol columns.
- D1: add policy/expiry/deletion status to game summaries and export requests.
- API: page replay by item and response-byte limits; expose expiry/policy without
  private payload metadata.
- Client: cache carries expiry and visibility; expired replay is an explicit
  unavailable state rather than an empty game.

## Required proof

Tests must show byte-stable replay across projector changes, correct participant
and public visibility, anonymization without cross-seat disclosure, complete
resumable deletion, bounded replay pages, and consistent retirement of code and
retained artifacts.
