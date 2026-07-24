---
sidebar_position: 5
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
   retry is clean — the route surfaces a 502 ("intact, retry"), never a partial
   deletion.
3. Purge D1 as one explicit `batch()`: anonymize the seats and `created_by` (so
   finished-game history stays readable as "Deleted User"), delete ratings,
   history, relationships, and device rows, then the `users` row last. Delete the
   avatar object if present.

## The cron backstop

The `scheduled` handler does only what has no per-entity timer of its own —
notably **not** a timeout sweep (the [DO alarm](../concepts/timing.md) owns that):

- **Stale-guest purge**: anonymous accounts past an age with no recent game
  activity, torn down through `purgeUser`.
- **Abandoned-game reap**: never-started lobbies past a TTL, and untimed active
  games (which have no alarm) idle past a longer TTL — `abort`ed so they stop
  occupying the lobby and release their DO storage.

Both jobs are best-effort, isolated (one failing never blocks the other), and
batch-capped so a backlog drains over days. Every window and cap is a **default
overridable via a `lifecycle` block on `createEngine`** (`guestMaxAgeMs`,
`guestInactivityMs`, `lobbyTtlMs`, `untimedActiveTtlMs`, `guestBatch`,
`reapBatch`).
