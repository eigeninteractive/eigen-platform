---
sidebar_position: 12
title: Failure model
description: Single attempt, no retry machinery, and why that is safe when everything is either idempotent or self-healing.
---

# Failure model

The engine's failure posture is uniform and blunt: **single attempt + error log,
no retry machinery in v1.** This is a deliberate constraint, and it is safe
because the architecture makes almost everything either idempotent or
self-healing:

- A lost **bot wake** or **push** is backstopped by the turn deadline / the app
  catching up on open; neither is a correctness dependency.
- A failed **D1 finish-apply** leaves the DO's `outbox` row in place; a gated
  admin re-poke re-runs it, idempotent via `finish_id`.
- A **duplicate command** replays the response stored under its
  `(principal, commandId)` receipt; the same id carrying different intent is
  refused as `commandConflict` rather than guessed at. A **duplicate
  finish-apply** is a no-op (`finish_id`).
- A **lost `setAlarm`** after its deadline committed is repaired by the next
  command of any kind, because the alarm is derived from committed state rather
  than tracked beside it (see [Timing](./timing.md)).
- A **crashed deletion** never half-deletes (the games→Firebase→D1 order; see
  [Account lifecycle](./account-lifecycle.md)).
- **D1 mirror staleness** is accepted by design: the DO is the truth, and a
  stale summary only ever costs a lobby a clean late rejection.

Post-commit DO effects run as unawaited, self-catching promises (a Durable Object
stays alive while a promise is pending, so `waitUntil` is redundant there). A
genuine server fault, a game-hook bug or a storage failure, surfaces as a 500 and
is logged; it never corrupts the append-only log, because it happens either
before the commit (nothing written) or after it (the commit already stands).
