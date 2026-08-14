---
"@eigeninteractive/server": minor
---

Deduplicate game creation on the `Idempotency-Key`, so a retried create returns
the game it already made instead of a second one.

Every other game mutation is committed by a game's Durable Object, which stores
its receipt beside the state change. Creation has no game yet, so its receipt is
two new columns on the `games` row — `create_command_id` and `create_request` —
written in the same INSERT as the rest of it. A new
`idx_games_create_key` UNIQUE index on `(created_by, create_command_id)` is what
makes a second create under the same key impossible.

- A retried `POST /games` returns the original `gameId` and `shortCode`, and
  fans out no second round of friend invites.
- A retried `POST /games/solo` returns the same running game. It is two
  operations under one key: the create is recognised from its receipt, and the
  start is re-issued under an id derived from that key, which also resumes a
  create whose process died before the start landed.
- Reusing a key for a materially different create is refused with
  `422 commandConflict`, matching the behaviour of every other mutation.
- Keys are scoped per creator, so two callers may independently choose the same
  one.

The receipt is kept for the life of the game, like the Durable Object's own
receipts and for the same reason: an expired receipt would let an ancient retry
become a new mutation. It costs nothing, because the row exists anyway.

**Migration.** These columns are added to the initial D1 migration rather than a
forward one, since no deployment exists yet: re-apply migrations
(`wrangler d1 migrations apply`) and discard local development data
(`rm -rf .wrangler`).
