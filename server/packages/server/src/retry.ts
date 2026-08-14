/**
 * Bounded retry with jittered exponential backoff.
 *
 * Deliberately transport-agnostic: the caller supplies the predicate deciding
 * which failures are worth retrying. Two live users, with very different
 * predicates and budgets:
 *
 * - background D1 mirror writes (`isTransientD1Error`, in `d1/errors.ts`);
 * - Worker-to-Durable-Object calls (`isRetryableDoError`, in `game-stub.ts`).
 *
 * The shared discipline is the same in both: retry only *transient
 * infrastructure* failures, never a deterministic one, where retrying would burn
 * the budget before surfacing the real problem, and never an overload, where the
 * documented remedy is to shed load rather than add to it.
 */

export interface RetryOptions {
  /** Total attempts including the first. Default 4. */
  attempts?: number;
  /** First backoff, doubling each retry. Default 50ms. */
  baseDelayMs?: number;
  /** Backoff ceiling. Default 2000ms. */
  maxDelayMs?: number;
  /** Which failures are worth retrying. Required: there is no safe default,
   * because "retryable" is a property of the transport AND of whether the
   * operation can be applied twice. */
  shouldRetry: (error: unknown) => boolean;
  /** Observe each retry (logging); never throws into the loop. */
  onRetry?: (error: unknown, attempt: number) => void;
  /** Delay primitive, injectable so tests run without real timers. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `op`, retrying a *retryable* failure with jittered exponential backoff up
 * to `attempts`. A non-retryable failure, or the last attempt, throws.
 *
 * Safe to leave unawaited inside a Durable Object: the DO stays alive while the
 * returned promise (and its backoff timers) is pending, so the whole sequence
 * runs to completion without `waitUntil`, exactly like the single-attempt writes
 * it wraps.
 *
 * `op` MUST be idempotent: a retry can fire after an operation that actually
 * landed but whose acknowledgement was lost. Nothing here can detect that, so it
 * is the caller's invariant, not this function's.
 */
export async function withRetry<T>(op: () => Promise<T>, options: RetryOptions): Promise<T> {
  const attempts = options.attempts ?? 4;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const sleep = options.sleep ?? defaultSleep;
  let delay = options.baseDelayMs ?? 50;

  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (error) {
      if (attempt >= attempts || !options.shouldRetry(error)) throw error;
      options.onRetry?.(error, attempt);
      // Jitter: wait a random point in [delay, 2·delay) so concurrent callers
      // recovering from the same blip do not resynchronise onto one instant.
      await sleep(delay * (1 + Math.random()));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}
