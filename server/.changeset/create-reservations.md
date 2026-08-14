---
"@eigeninteractive/server": minor
---

Deduplicate game creation on the `Idempotency-Key`, so a retried create returns
the game it already made instead of a second one.

Every other mutation is committed by a game's Durable Object, which stores its
receipt in the same transaction as the state change. Creation has no game yet, so
its receipt is a new `game_creations` row written in the same D1 batch as the
`games` row — that batch is a transaction, so a create can never leave a game
without its reservation nor a reservation without its game.

- A retried `POST /games` returns the original `gameId` and `shortCode`, and
  fans out no second round of friend invites.
- A retried `POST /games/solo` returns the same running game. It is two
  operations under one key: the reservation replays the create, and the start is
  re-issued under an id derived from that key, which also resumes a create whose
  process died before the start landed.
- Reusing a key for a materially different create is refused with
  `422 commandConflict`, matching the behaviour of every other mutation.
- Keys are scoped per principal, so two callers may independently choose the
  same one.

The cron backstop gains a third job that prunes reservations past
`lifecycle.createReservationTtlMs` (default 24 hours). The row only has to
outlive a retry of its own create, not serve as history.

**Migration.** `game_creations` is added to the initial D1 migration rather than
a forward one, since no deployment exists yet: re-apply migrations
(`wrangler d1 migrations apply`) and discard local development data
(`rm -rf .wrangler`).
