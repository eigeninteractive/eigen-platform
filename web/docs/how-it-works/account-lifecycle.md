---
sidebar_position: 14
title: Account lifecycle & the cron
description: Why deletion is ordered games → Firebase → D1, and what the daily cron backstops.
---

# Account lifecycle & the cron

## Deletion & guest purge share one path

`DELETE /api/engine/me` (self-service) and the cron's stale-guest sweep both run
`purgeUser`, ordered **games → Firebase → D1**. The order is load-bearing:
because the auth middleware re-provisions a `users` row on *any* valid token,
deleting the D1 row while the Firebase account still lives would let the very
next request resurrect the user. So:

1. Forfeit / cancel / leave every one of the user's live games (a rated forfeit
   applies its ratings while the user row still exists).
2. Delete the Firebase account (Identity Toolkit admin `accounts:delete`). On
   failure this throws **before** any D1 write, so nothing is half-deleted and a
   retry is clean: the route surfaces a 502 ("intact, retry"), never a partial
   deletion.
3. Purge D1 as one explicit `batch()`: anonymize the seats and `createdBy` (so
   finished-game history stays readable as "Deleted User"), delete ratings,
   history, relationships, and device rows, then the `users` row last. Delete the
   avatar object if present.

## The cron backstop

The `scheduled` handler does only what has no per-entity timer of its own,
notably **not** a timeout sweep (the [DO alarm](./timing.md) owns that):

- **Stale-guest purge**: anonymous accounts past an age with no recent game
  activity, torn down through `purgeUser`.
- **Abandoned-game reap**: never-started lobbies past a TTL, and untimed active
  games (which have no alarm) idle past a longer TTL, `abort`ed so they stop
  occupying the lobby and release their DO storage.
- **Read-model reconciliation**: games D1 still believes are live but has stopped
  hearing from, repaired from the authoritative Durable Object.

All three are best-effort, isolated (one failing never blocks the others), and
batch-capped so a backlog drains over days. Every window and cap is a **default
overridable via a `lifecycle` block on `createEngine`** (`guestMaxAgeMs`,
`guestInactivityMs`, `lobbyTtlMs`, `untimedActiveTtlMs`, `guestBatch`,
`reapBatch`, `deadlineGraceMs`, `mirrorStaleMs`, `reconcileBatch`).

### Why reconciliation exists

D1's game rows are a [read model](./storage.md): the DO writes them off the
response path, because a commit whose truth is already durable must never fail on
a display copy. That choice has a cost. A mirror write can be lost after its
retries, leaving D1 quietly stale. And a finish whose D1 apply fails keeps its
outbox row in the DO, waiting to be asked again — otherwise that game's rating
deltas are never written at all, which is the worst outcome available here.

D1 cannot tell which happened, or even that anything did: it holds a plausible row
that has simply stopped changing. So the sweep looks for the two ways a live game
can be *provably* quiet — an active game long past its committed turn deadline
(whose alarm should have fired and written by now), and any non-terminal game with
no D1 update for a week (the only signal available for an untimed game, which has
no deadline to be late for) — and asks the object what is true.

The repair itself is idempotent: it rewrites the roster and summary rows from
committed state, retries a retained finish, and re-arms the alarm if it disagrees.
A healthy game caught by a coarse predicate costs one wake and changes nothing. The
same repair is available for a single game through the
[operator surface](../ship-it/configure.md#the-operator-surface-optional).
