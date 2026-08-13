# 0007: replay fidelity, retention, and privacy

- Status: accepted
- Date: 2026-08-13

## Decision

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

Deleting an account anonymizes its engine-owned identity without rewriting
immutable game facts or exposing another seat's private frame. Initial account
deletion does not implicitly delete a solo or multiplayer game. Public replay
is generated deliberately and never falls back to a participant frame.

## Retention model

vNext launches with no time-based expiry for finished games:

```text
finishedGameRetention = indefinite
```

The authoritative transition log, exact private frames, explicit public replay
frames, command records, and D1 summaries remain until an explicit deletion or
future accepted retention policy removes the game. "Indefinite" means no
scheduled product deletion; it is not a promise that the service, an account,
or a deployment will exist forever.

This is the appropriate pre-production default because there is no measured
storage pressure or user expectation from which to derive a useful duration.
It preserves replay, keeps command deduplication unambiguous, and avoids building
a cross-store deletion workflow against guessed requirements. Per-command,
per-transition, state-size, frame-size, and replay-page limits still bound one
game; metrics must make aggregate storage growth visible.

There is no automatic deletion job, expiry column, or cold-storage tier in the
initial design. If storage cost, access patterns, privacy, or product policy
later justify deletion or archival, a new accepted decision must define the
eligibility rule, user-visible behavior, export window, failure recovery, and
consistent removal across every store before implementation begins.

## Export and deletion

- Export names policy version, contract ID, and visibility class.
- Participant export includes only that principal's exact frames and
  engine-owned identity data.
- Operator/debug export of authoritative opaque state is privileged, audited,
  time-bounded, and never written to routine logs.
- Account deletion is a retryable anonymization workflow for engine-owned
  identity/profile data; retained opaque game facts use principal IDs only.
- Whole-game deletion is not a generic vNext launch API. When it is introduced,
  it must be retryable, resumable, and visibly consistent across stores.

## Migration sketch

- DO: retain exact frames after finish and add public replay frames plus artifact
  contract/protocol columns; do not add speculative expiry/deletion state.
- D1: keep durable game summaries without an expiry field.
- API: page replay by both item and response-byte limits.
- Client: cache carries replay visibility; an unavailable or explicitly deleted
  game is distinct from an empty game.

## Required proof

Tests must show byte-stable replay across projector changes, correct participant
and public visibility, anonymization without cross-seat disclosure, bounded
replay pages, durable command deduplication, and consistent retirement of code
while retained artifacts still reference it. A future deletion feature must add
its own end-to-end resumability and cross-store consistency proofs.
