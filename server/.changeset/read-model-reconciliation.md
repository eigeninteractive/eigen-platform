---
"@eigeninteractive/server": minor
---

Repair D1 read models that have fallen behind the Durable Object, and add the
operator surface that runs the same repair on demand.

**The defect.** `GameStub.repokeFinish` existed, was tested, and **nothing called
it.** A finish whose D1 apply fails keeps its outbox row in the DO precisely so it
can be retried — but with no caller, that row was kept forever and the game's
rating deltas were never written. Silent, permanent, and invisible from D1, which
just holds a plausible row that stopped changing. The same silence is what a lost
post-commit mirror write looks like, since `#mirrorD1` gives up after its retries
rather than failing a commit whose truth is already durable.

**`GameStub.reconcile(gameId)`** is the repair: rewrite D1's roster and summary
rows from committed state, retry a retained finish, re-arm the alarm if it
disagrees, and report what it found. Idempotent, so it is safe on a healthy game.
It deliberately does **not** lazy-init — lazy init reads the games row *from D1*,
so an object with no committed state has nothing more authoritative than the row it
would be repairing, and reconciling it would read the stale copy, write it back,
and report success. That case reports `initialized: false` instead.

**A third cron job** finds candidates without being told which defect it is
looking at: an active game long past its committed turn deadline (its alarm should
have fired and written by now), or any non-terminal game with no D1 update for
`mirrorStaleMs`. The second is the only signal that finds a stuck finish on an
untimed game, which has no deadline to be late for. Oldest first, batch-capped —
each candidate wakes a Durable Object, so this is the tightest of the three
batches. New `lifecycle` options: `deadlineGraceMs` (6h), `mirrorStaleMs` (7d),
`reconcileBatch` (100). `mirrorStaleMs` must stay below `untimedActiveTtlMs` or the
reap aborts such a game before this can repair it.

**New: `/api/ops`,** gated by an `OPS_TOKEN` secret. `GET /api/ops/games/{id}`
shows the DO's view and D1's side by side; `POST /api/ops/games/{id}/reconcile`
runs the repair. Every route answers **404** while `OPS_TOKEN` is unset, so a
deployment that never configures one has no surface to probe rather than a guarded
one. Not in the OpenAPI document and not in the generated clients: a player's app
has no business knowing these routes exist.

`inspect` returns the **unseated** session view — what a spectator sees, carrying
no observation data — so it cannot become a cheating channel for a live game
whoever holds the secret. The token is compared by SHA-256 digest in an
accumulating loop, since Workers has no `timingSafeEqual`.
