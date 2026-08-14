---
sidebar_position: 12
title: Failure model
description: Retry only what is provably repeatable, single attempt everywhere else, and why that is safe when the rest is idempotent or self-healing.
---

# Failure model

The engine's failure posture has one rule: **retry only what is provably
repeatable; single attempt and an error log everywhere else.** "Provably" is the
load-bearing word — a retry is earned by an identity or an absolute value that
makes reapplying the operation a no-op, never by an assumption that the first
attempt did nothing.

Exactly two things qualify, and both are narrow:

- **A Worker-to-Durable-Object call.** Cloudflare marks some failures
  `retryable` — an object reset because its code was updated (every deploy), a
  rescheduled host, a dropped hop. Every command the Worker sends carries a
  stable identity, so the object either commits it once or replays its receipt;
  the call is retried twice with jittered backoff, each attempt on a fresh stub.
  An `overloaded` error is never retried (the remedy is to shed load), and
  neither is an exception the game itself threw. Without this, a deploy landing
  mid-move would cost a player their turn: the 500 it would otherwise produce
  carries a response, so a client cannot tell it from a deliberate refusal.
- **A background D1 mirror write** (roster and summary). Both write absolute
  values re-derivable from the DO at any time, and they have no reconciliation
  sweep, so a single transient blip would otherwise leave the read model
  permanently stale — a lying "your turn" badge, a frozen lobby countdown.

Everything else is single attempt, and safe because the architecture makes it
either idempotent or self-healing:

- A lost **bot wake** or **push** is backstopped by the turn deadline / the app
  catching up on open; neither is a correctness dependency.
- A failed **D1 finish-apply** leaves the DO's `outbox` row in place; a gated
  admin re-poke re-runs it, idempotent via `finish_id`.
- A **duplicate command** replays the response stored under its
  `(principal, Idempotency-Key)` receipt; the same key carrying different intent
  is refused as `commandConflict` rather than guessed at. A **duplicate
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
