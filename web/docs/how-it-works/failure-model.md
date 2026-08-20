---
sidebar_position: 12
title: Failure model
description: Retry only operation-specific idempotent work, resynchronize ambiguous client outcomes, and repair derived state from the Durable Object.
---

# Failure model

The engine retries only an operation whose own semantics make repetition safe.
There is no universal command identity and no assumption that a failed request
did nothing.

The main automatic retry is a **background D1 mirror write** (roster and
summary). These writes use absolute
  values re-derivable from the DO at any time, and they have no reconciliation
  ambiguity: a single transient blip would otherwise leave the read model stale
  until reconciliation.

Client game mutations are single-attempt. A response proves acceptance or
rejection. A transport failure after sending is unconfirmed: the client drops
optimistic UI and reloads the authoritative session. It does not blindly replay
an action that may already have committed. Creation may remain ambiguous; after
resynchronizing the player can create again.

The remaining recovery paths are operation-specific:

- A lost **bot wake** or **push** is backstopped by the turn deadline / the app
  catching up on open; neither is a correctness dependency.
- A failed **D1 finish-apply** leaves the DO's `outbox` row in place; a gated
  admin re-poke re-runs it, idempotent via `finish_id`.
- A **duplicate finish-apply** is a no-op through its internal `finish_id`.
- Start, cancel, join, and leave converge on their lifecycle or membership
  state rather than storing generic command results.
- A **lost `setAlarm`** after its deadline committed is repaired by the next
  command of any kind, because the alarm is derived from committed state rather
  than tracked beside it (see [Timing](./timing.md)).
- A **crashed deletion** never half-deletes (the games→Firebase→D1 order; see
  [Account lifecycle](./account-lifecycle.md)).
- **D1 mirror staleness** is accepted by design: the DO is the truth, and a
  stale summary only ever costs a lobby a clean late rejection.

Post-commit DO effects run as self-catching promises. A genuine server fault, a
game-hook bug, or a storage failure surfaces as a 500 and is logged; it never
partially commits the authoritative transition because the decision and SQLite
write are one synchronous transaction.
