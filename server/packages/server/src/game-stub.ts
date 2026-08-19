/**
 * The Worker's side of talking to a game's Durable Object: which failures are
 * worth another attempt, and the wrapper that makes one.
 *
 * A Durable Object call can fail for reasons that have nothing to do with the
 * command: the object was reset because its code was updated (every deploy), its
 * host was rescheduled, a network hop dropped. Cloudflare marks those errors
 * `retryable`. Left alone they surface as a `500 Internal server error`, which is
 * the worst possible answer here — it carries a response, so the Flutter client
 * cannot tell it from a deliberate server decision and (correctly) does not
 * retry. A player loses a move to a deploy.
 *
 * The Worker is the only place that can fix this, and it can only fix it because
 * every command it sends to a Durable Object carries a stable identity:
 *
 * - the game routes pass the caller's `Idempotency-Key`;
 * - create-solo's start derives its id from that key;
 * - the account purge uses `purge:<user>:<game>`;
 * - the bot webhook uses `botaction:<bot>:<game>:v<version>:seat<n>`.
 *
 * So the object either commits the command once or replays the receipt it
 * already committed. That is what makes a retry safe, and it is why this could
 * not be built before receipts existed: `retryable` does NOT promise the
 * operation was skipped. Cloudflare's wording is that such errors "are suggested
 * to be retried if requests to the Durable Object are idempotent" — the
 * idempotency is the caller's job, and here it is the receipt's.
 */

import type { GameStub } from "./protocol.js";
import { type RetryOptions, withRetry } from "./retry.js";

/**
 * Total attempts for one Durable Object call, and the first backoff.
 *
 * Tighter than the background-D1 budget (4 attempts, up to a 2s cap) because
 * this runs inside a request a player is waiting on: two retries at 50ms and
 * 100ms base, jittered, bound the added latency at roughly 300ms. That is enough
 * for the dominant fault by far — a code-update reset during a deploy, where the
 * very next attempt lands on the new version — without turning a genuine outage
 * into a request that hangs before failing anyway.
 */
const DO_ATTEMPTS = 3;
const DO_BASE_DELAY_MS = 50;

/**
 * True for a Durable Object error Cloudflare marks retryable and does not also
 * mark overloaded.
 *
 * Structured properties, not message matching, unlike the D1 predicates: the
 * runtime sets `retryable` and `overloaded` on the error itself. Requiring
 * `retryable === true` fails closed, so an application exception thrown by the
 * game (a `GameBugError`, an integrity violation) is never retried — it carries
 * no such property, and repeating it would only delay the report.
 *
 * `overloaded` vetoes the retry even when `retryable` is also set: Cloudflare's
 * guidance is explicit that overloaded errors "should not be retried", because
 * retrying is what caused the overload.
 */
export function isRetryableDoError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { retryable, overloaded } = error as { retryable?: unknown; overloaded?: unknown };
  return retryable === true && overloaded !== true;
}

/**
 * Wrap a game stub so every call retries a transient Durable Object failure.
 *
 * `connect` is called again for each attempt, on purpose: Cloudflare documents
 * that a `DurableObjectStub` should not be reused after it throws, because many
 * exceptions leave it in a broken state. Retrying on the same stub would fail
 * for that reason alone, so the factory — not a stub — is what gets passed in.
 *
 * Every method is retried except {@link GameStub.fetch}, which carries the
 * WebSocket upgrade. A retry there is meaningless (the client is upgrading one
 * connection, and the `Request` body is not replayable), so it passes straight
 * through and a failure surfaces as it always did.
 */
export function retryingGameStub(connect: () => GameStub, options?: Partial<RetryOptions>): GameStub {
  const call = <T>(op: (stub: GameStub) => Promise<T>): Promise<T> =>
    withRetry(() => op(connect()), {
      attempts: DO_ATTEMPTS,
      baseDelayMs: DO_BASE_DELAY_MS,
      shouldRetry: isRetryableDoError,
      onRetry: (error, attempt) => console.warn(`durable object call failed, retrying (attempt ${attempt})`, error),
      ...options,
    });
  return {
    handle: (cmd) => call((stub) => stub.handle(cmd)),
    session: (gameId, userId) => call((stub) => stub.session(gameId, userId)),
    frames: (args) => call((stub) => stub.frames(args)),
    repokeFinish: () => call((stub) => stub.repokeFinish()),
    reconcile: (gameId) => call((stub) => stub.reconcile(gameId)),
    abort: (gameId) => call((stub) => stub.abort(gameId)),
    fetch: (request) => connect().fetch(request),
  };
}
