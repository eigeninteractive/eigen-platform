---
sidebar_position: 4
title: The game session
description: One Durable Object per game. Its SQLite schema, lazy initialization, the command pipeline, and why versions are strictly serial.
---

# The game session: one Durable Object per game

`BaseGameDO` is the abstract base an implementor subclasses. Each instance is
one game, addressed deterministically by `idFromName(gameId)`.

## The per-game SQLite schema

The DO's own SQLite database is the game. Six tables:

| Table | Lifetime | Purpose |
|---|---|---|
| `meta` | permanent | The single game row (id, short code, status, access, schema_version, config, timing, rated, pool, roster bounds, creator, rng seed, final outcomes, and `seq`). Copied once from D1 at lazy-init, then DO-owned. `seq` is the monotonic session counter every commit advances, which is what totally orders the snapshots the socket pushes; `outcomes` is retained rather than drained so a cold open of a finished game is answerable from the DO alone. |
| `roster` | permanent | One row per seat (`player_index`, `user_id`/`bot_id`, `type`). The **authoritative** roster; D1's copy is a display mirror. |
| `transitions` | permanent | **Append-only, immutable.** One row per version: the opaque `state`, the `action` that produced it, the pending set, deadline, per-player clocks. This table *is* the game's history. |
| `frames` | live-only | Per-seat projected observations, for socket gap-recovery and the same-view compare. Drained by the finish compaction (replay re-projects instead). |
| `commands` | live-only | `command_id → stored response` for idempotent retries. Drained by the finish compaction. |
| `outbox` | transient | What the D1 finish-apply needs, written atomically with the finishing transition and cleared only *after* the apply succeeds. Its presence is the recovery signal. |

The schema is engine-owned and self-applying: a drizzle `durable-sqlite`
migration bundle is compiled into the Worker and runs inside
`blockConcurrencyWhile` on first activation, so even a finished game woken years
later migrates itself before serving anything.

## Lazy initialization

A game's D1 row is written *before* its DO exists (creation is a direct Worker →
D1 write; see [The game lifecycle](./lifecycle.md)). The DO is created lazily on
first contact (first command or socket): it reads the game + participants from
D1 once, inside `blockConcurrencyWhile`, and copies them into `meta` + `roster`.
From then on the DO owns `status` and `rng_seed`; D1's copy becomes a display
read-model updated from DO effects. If no game row exists in D1, first contact
resolves to a clean `unknownGame`.

## The command pipeline & idempotency

Every command that crosses the Worker → DO boundary is a **self-contained,
pre-authenticated value** (`Command`): the kind, the game id, a `commandId`, the
acting `Principal` (a user id *or* a bot id, never both), and the payload. The
Worker has already verified the token and run every *policy* check before minting
it; the DO enforces *integrity* (seat occupancy, status, versions) under its
gate. This clean split, policy at the edge and integrity in the DO, means a
command is loggable, replayable, and a CI fixture is just a JSON array of them.

Two idempotency keys keep the pipeline exactly-once:

- **`commandId`** (client → DO): the caller's `Idempotency-Key` header. The DO
  keys each committed command's response by `(principal, commandId)` and replays
  it verbatim for a matching retry, so a client retry never double-applies a move.
  The same key carrying a *different* request is refused as `commandConflict`
  rather than guessed at, and the key is scoped to its principal, so one caller's
  key can never replay another's session. (Rejections are recomputed fresh, since
  re-evaluating one is always sound.)
- **`finish_id`** (DO → D1): the finishing transition mints one; the D1 apply is
  a no-op if the games row already carries it, so a re-poked finish is safe.

Serialization orders commands but cannot *identify* duplicates; that is what the
ids are for.

## Versions are strictly serial

Every accepted command commits as the next integer version, in arrival order, with
**no gaps, ever**. The same-view rule governs *acceptance* only; it never
reorders or skips versions. This invariant is what lets the client recover any
gap by a simple version-range fetch and lets replay walk the log linearly.
