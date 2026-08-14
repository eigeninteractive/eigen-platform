---
"@eigeninteractive/server": minor
---

Carry the mutation command id in the standard `Idempotency-Key` request header,
and require it.

**Breaking.** Every game mutation now requires the `Idempotency-Key` header and
no longer accepts a `commandId` body field. The server no longer mints one when
it is absent: that fallback silently gave every attempt a fresh identity, which
is no idempotency at all. A request without the header is refused with
`400 idempotencyKeyInvalid`.

Account, social and device routes are unchanged and require no key: they are
set-like operations whose repetition already reaches the same state.

`commandConflict` moves from 409 to 422, matching the `Idempotency-Key`
specification and keeping 409 honest: every other 409 here means "your view is
stale, resync and retry", which is exactly what a caller must not do with a key
already committed for a different request.

Leave, cancel and start no longer take a request body at all, so the empty
`LobbyCommand` schema is gone.

`@eigeninteractive/server/testing` gains `testMutationHeaders`, which supplies
the bearer token, the content type, and a fresh key — or an exact one, to
exercise a retry.

Creation deduplicates on it too; see the create-reservation changeset.
