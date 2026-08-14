---
"@eigeninteractive/server": minor
---

Retry a transient Durable Object failure instead of turning it into a 500.

A Durable Object call can fail for reasons unrelated to the command: the object
was reset because its code was updated (which happens on every deploy), its host
was rescheduled, a network hop dropped. Cloudflare marks those errors
`retryable`. Until now they surfaced as `500 Internal server error`, which is the
worst available answer — it carries a response, so a client cannot distinguish it
from a deliberate server decision and correctly declines to retry. A player lost
a move to a deploy.

Every game stub call except the WebSocket upgrade now retries such a failure
twice with jittered backoff (~300ms worst case), and each attempt builds a fresh
stub, because Cloudflare documents that a `DurableObjectStub` must not be reused
after it throws.

This is safe only because every command the Worker sends carries a stable
identity — the caller's `Idempotency-Key`, a derived id for create-solo's start,
or a deterministic id for the account purge and the bot webhook — so the object
either commits once or replays its receipt. `retryable` does **not** promise the
operation was skipped; Cloudflare's guidance is to retry such errors *if requests
are idempotent*, and receipts are what make them so. Overloaded errors are never
retried, and an exception thrown by the game itself is never retried, since the
predicate requires the runtime's own `retryable` flag.

`isRetryableDoError` and `retryingGameStub` are exported for implementors calling
a game stub directly.

**Breaking, for direct `withRetry` callers only.** `RetryOptions.shouldRetry` is
now required and `withRetry` moved to `@eigeninteractive/server`'s root module
(the package export path is unchanged). It previously defaulted to the D1
predicate, which silently made "retry with D1 semantics" the behaviour for any
caller, including ones retrying something that was not D1. Pass
`shouldRetry: isTransientD1Error` to keep the old behaviour.
