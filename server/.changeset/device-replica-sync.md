---
"@eigeninteractive/server": minor
---

**Breaking.** A device now keeps a replica of its account and refreshes it with one request (decision 0013).

`GET /api/engine/me/sync` returns the caller's profile, ratings, friends, pending requests, and every game still in play, whole; and their finished games incrementally, ordered by the sequence a finish is given when it commits, with the identities of everyone seated. Without `finishedAfter` it returns the newest page of history instead, the account's highest cursor, and a `historyFloor`, from which `GET /api/engine/me/games/finished` pages older history.

Removed, because the sync replaces them: `GET /games/mine`, `GET /me/ratings`, `GET /me/rating-history`, `GET /friends`, and `GET /friends/requests`. `PUT /me/username`, `PUT /me/display-name`, and `PUT /me/avatar` now answer with the whole `Profile`.

`GameSummary` carries `seq`, the game's revision, the same counter a `Session` carries. Every D1 mirror write now names the commit it mirrors and lands only when the row is not already newer, so a retried older write no longer overwrites a newer summary or roster. D1 gains `games.seq` and a `game_finishes` table whose AUTOINCREMENT `seq` is the history sync cursor, and no longer carries the rating-history index nothing reads any more.

Migrating: the migrations collapse to a single `0000` baseline that creates the schema as it now stands, so recreate the database rather than migrating onto it — the tags a database may already have applied no longer exist. Pre-1.0 the schema is rewritten in place rather than accumulating a step per change. A client that listed games, ratings, or friends through the removed routes reads them from `syncAccount` instead.
