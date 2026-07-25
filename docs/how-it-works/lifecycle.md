---
sidebar_position: 5
title: The game lifecycle
description: Creation, the waiting room, active play, finish and history compaction, cancel and abort.
---

# The game lifecycle, end to end

## Creation — the one Worker-direct write

`POST /api/engine/games` is the single place the Worker writes game state to D1
directly, because the DO does not exist yet. The Worker runs all creation policy
(guest gates, config parse against the version schema, the `ratingPool`
decision, and validation of the client's concrete `rated` assertion), generates
a unique `shortCode` (a readable 6-char code with a retry loop on the UNIQUE
index), and writes the games + participants rows with the creator in seat 0.
The DO is not touched; it will lazy-init on first command or socket.

:::info `rated` is a validated assertion, never a coercion

The client computes it too (via the Dart twin of `ratingPool`), and a mismatch is
rejected rather than silently "corrected" — that catches twin drift and forged
clients.

:::

## The waiting room

Before a game starts, the roster is mutable. Join / leave / cancel / add-bot /
start are **Commands to the DO**, with policy checked at the Worker *before*
minting (guest-vs-rated, friends-access, schema gate — no D1 reads inside the
gate) and integrity enforced in the DO (status, seat occupancy, creator-only
rules). Highlights:

- **Join** by id or by shortCode. Creating with `minPlayers` already satisfied
  makes a game `ready`; otherwise `waiting`.
- **Leave** compacts seat indexes (safe pre-start, since no transition references
  a seat yet). The creator cannot leave — they cancel.
- **Add-bot** is creator-only and passes the [bot seating gates](./bots.md).
- **Cancel** is creator-only, drops the DO's storage, and marks the D1 row
  `aborted` (the D1 write is *awaited* here, unlike other lobby effects, because
  the aborted row is the only survivor).
- **Start** is creator-only, commits version 0 via the kernel, and arms the
  first deadline.

The client opens its WebSocket *before* start. Pre-game, the DO pushes
unversioned, idempotent **roster snapshots** on every change (a reconnect just
gets the current one); versioned frames begin at v0. D1's participants copy is
updated post-commit and is allowed to be briefly stale — a stale lobby just means
a join can fail cleanly at the DO.

**create-solo** (`POST /api/engine/games/solo`) collapses "create a private game
seated with me + bots, and start it" into one call, returning the caller's
opening v0 frame so the client can render immediately. Guests may play bots
(unrated).

## Active play

A move is `POST /api/engine/games/{id}/action` carrying the caller's own `seat`,
the `expectedVersion` it computed against, and the game-defined `data`. The DO
verifies the seat belongs to the caller against its authoritative roster (a seat
you don't hold is a clean 403), runs the kernel, and — on accept — commits the
next version and rides the caller's own projected frame back on the response.
Every other seat's frame arrives over its socket. Forfeit is the same shape with
a `lifecycle`/`forfeit` intent.

Humans and bots submit a seat **uniformly**; the DO resolves the actor (user id
from the token, bot id from the HMAC claim) against the roster the same way for
both. There is no server-side "figure out my seat" fallback.

## Finish, and history compaction

When a hook returns an `outcome`, the finishing transition commits `status =
finished` and writes an `outbox` row *in the same SQLite transaction*. Then,
post-commit and off the response path:

1. **The D1 finish-apply** writes the game summary + outcomes, and (for rated
   games) runs the [rating CAS](./storage.md). It is idempotent via `finish_id`.
2. On success, a final **ratings transition** (version N+1) is appended for
   rated games — carrying each seat's rating delta — and **the compaction rides
   the outbox clear**: one SQLite transaction empties the live-only `frames` and
   `commands` tables and deletes the `outbox` row. ~20–40 KB of permanent
   `transitions` + `meta` + `roster` remain.

The outbox row is the recovery signal: if the D1 apply fails, it survives, and a
gated admin re-poke re-runs the apply (idempotent). DO storage is **never**
dropped at finish — only at cancel/abort. The finished DO *is* the game's
history.

## Cancel & abort

Cancel (creator, pre-start) and abort (the cron reap of abandoned games; see
[Account lifecycle & the cron](./account-lifecycle.md)) mark the D1 row
`aborted` and drop the DO's storage entirely — there is no history object for a
game that never really happened. Abort is unconditional (no creator gate, works
even on a never-initialized DO).
