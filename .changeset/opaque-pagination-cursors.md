---
"@eigeninteractive/server": minor
---

Pagination cursors are now opaque tokens, and empty query parameters are treated as absent.

Every paged list could silently return nothing. A client that sent an optional
query parameter it had no value for produced `?cursor`, which arrives as the
empty string, and `z.coerce.number()` is `Number()`, so `""` became `0`. Zero is
a structurally valid integer cursor meaning "strictly older than the beginning of
time", so the request did not fail: the lobby, both `games/mine` buckets, the
friends list and every history screen returned `200` with an empty array. Nothing
was logged, because nothing had gone wrong as far as any layer could tell.

Three changes, each closing a different part of it:

- **`cursor` is now an opaque string** rather than a bare epoch-millisecond
  integer, and paged responses carry a **`nextCursor`** that is null exactly when
  the list is exhausted. There is no byte string that accidentally decodes to the
  beginning of time, so the failure above cannot recur by construction. A cursor
  that does not decode is a `400` with the new `invalidCursor` code.
- **The cursor carries the row id alongside the sort value**, so pages no longer
  drop a row when two games share a timestamp - a limitation the previous
  implementation documented but did not fix. The comparison is a SQLite row value
  (`(sortKey, id) < (?, ?)`), which is planned against the same index.
- **Query parameters are parsed, never coerced.** This is the origin of the whole
  failure, and it took four correct layers to become invisible. `Number(null)` is
  `0`, so `z.coerce.number().int().min(0)` genuinely accepts null; the emitted
  schema honestly reported `["integer", "null"]`; `openapi-generator` correctly
  dropped its `if (x != null)` guard, because the API had declared null welcome;
  dio rendered that null as a bare `?to=`; and the server coerced `""` back to
  `0`. No library was misbehaving. Integer query parameters now parse from a
  strict pattern, so they reject null and empty alike, which means the generated
  client omits an absent parameter on its own and a malformed one is a loud `400`
  rather than a plausible, wrong `200`. `?pool=` and `?to=` were failing the same
  way and are fixed by the same change.

  A contract test now asserts that no query parameter in the published document
  is nullable, which is the tell that was invisible in review: `.min(0)` was
  nullable and `.min(1)` was not.

Because `nextCursor` is now an answer rather than something a client infers from
a short page, callers no longer need to know how any list is sorted, and a final
page that happens to be exactly full no longer triggers one pointless request.

Breaking for direct API consumers: `cursor` is a string, and the four paged
responses (`Lobby`, `MyGames`, `PlayerGames`, `FriendsGames`) gained a required
`nextCursor` field. The generated Dart client and `eigen_flutter` are updated to
match.
