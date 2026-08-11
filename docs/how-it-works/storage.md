---
sidebar_position: 7
title: Data & storage
description: Two stores with two jobs, the D1 schema, the concurrency-safe rating CAS, and how history and replay work.
---

# Data & storage

## Two stores, two jobs

- **DO SQLite** (per game) is *integrity + history*: the authoritative roster and
  the immutable transition log. Never read to serve a list.
- **D1** (global) is a *read-model + registry*: identity, social, bots, ratings,
  and game **summaries**. Never wake a DO to serve a read; lobbies, "my games",
  profiles, and leaderboards all read D1.

A game's summary row is created Worker-direct, then updated from DO effects after
each commit (accepted staleness). A summary carries dashboard hints (status,
whose turn, the deadline, final outcomes) but **never game state**. Raw state
lives only in the DO.

## The D1 schema

| Table | Purpose |
|---|---|
| `users` | Identity, keyed by Firebase uid (stable across guest→permanent upgrade). Merged users + profile. `avatar_url` defaults to the provider photo. |
| `games` | The summary/read-model row (timing, rated, pool, status, outcomes, short_code, `finish_id`, `finished_at`, a nullable `archived_at` cold-tier seam). |
| `participants` | The roster join table: one row per seat, the indexed access path for "games of user X". A display mirror of the DO roster. |
| `relationships` | Friend edges in canonical pair order. |
| `bots` | The [bot registry](./bots.md): `type` ∈ engine/external/local, `webhook_url` for external, capabilities `config`. CHECK-enforced. |
| `player_ratings` | Per-identity per-pool OpenSkill rating + a `revision` CAS counter. |
| `rating_history` | Immutable per-game rating log, unique per (game, identity), carrying `finish_id`. |
| `device_installations` | FCM push targets keyed by Firebase Installation ID (FID). |

D1 has **no foreign-key cascades**: relationships between tables are maintained
explicitly (for example, account deletion is an explicit preserve-vs-delete
batch; see [Account lifecycle](./account-lifecycle.md)). This is
deliberate: it keeps every multi-table effect visible in application code rather
than hidden in schema triggers.

Because `games` and `participants` are mirrors written after the DO's own commit,
they can lag it. To read both stores at once and see any disagreement between
them, see [Debugging a live game](../build-a-game/debugging.md).

## Ratings & the concurrency-safe CAS

Ratings are OpenSkill, computed **at finish, in D1**, because they depend on
global cross-game priors that any snapshot into the DO would render stale (games
can run for days). The whole apply (summary row, rating rows, history log, and
the `finish_id` marker) is **one D1 `batch()`**, so the dedupe marker and the
rows it guards can never disagree.

The write is a compare-and-swap on a per-rating `revision` counter, which fixes
the classic concurrent-finish lost-update bug:

1. Read each identity's `(mu, sigma, revision)` and compute the posteriors in TS.
2. Write each history row with revision-guarded subselects for its before-values
   (`SELECT mu FROM player_ratings WHERE …revision = <the one just read>`), and
   UPDATE the rating `WHERE revision = <that>`, bumping it.
3. If a concurrent finish already moved the revision, the subselect returns NULL,
   the NOT-NULL column rejects the row, the **whole batch rolls back**, and the
   engine re-reads fresh priors and recomputes (bounded retry).

The display rating shown on leaderboards is `max(0, round((mu − 3σ) · 40))`,
computed in one place in the kernel.

### The purge guard

A seat whose account was deleted mid-game still carries its user id in the DO
roster (the purge nulls only D1's mirror; it never wakes every game). A later
rated finish would therefore try to write a `player_ratings` row for a
non-existent user. So the apply reads which identities still exist and skips the
rating write (and its returned delta) for absent ones, while the purged seat
still shapes the OpenSkill field. Bots are never purged.

## History & replay

A finished game's DO holds its full transition log forever, so **replay is the
live range-fetch path pointed at a finished DO.** The client asks for a version
range; the DO projects each transition through `computeObservation(…, isReplay:
true)` for the caller's seat (or `null` for a public viewer). Live gap-recovery
and finished-game replay are literally the same endpoint; the only difference is
that a finished game's frames were compacted away, so replay re-projects from the
immutable `transitions` instead of reading the drained `frames` table.

Replay reads go through a one-method **`HistoryStore` seam**. V1 ships exactly one
implementation (the DO range-fetch) and no dispatch logic, but the seam is real:
a future cold tier can add an R2-backed implementation and a
"DO-if-present-else-R2" composition behind the same interface, and the replay
route never changes. Three more seams are already in place for that cold tier: a
store-agnostic replay contract, the field-for-field frozen-blob shape the
compaction already leaves behind, and a nullable `archived_at` column on the
games row that v1 never touches. History *lists* (as opposed to a single game's
replay) always read D1 summaries.

The free runway before any of that matters is ~125k–250k finished games in the
account-wide 5 GB DO SQLite quota.
