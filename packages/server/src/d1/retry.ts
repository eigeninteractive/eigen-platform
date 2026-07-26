/**
 * Bounded retry for idempotent background D1 writes.
 *
 * D1 auto-retries read-only queries, but never writes — Cloudflare's guidance
 * is to retry writes in app code when they are idempotent by the application's
 * own logic. The two summary mirrors (`updateSummary`, `mirrorRoster`) are
 * exactly that: both write absolute values re-derivable from the DO at any
 * time, so replaying one is harmless. They run fire-and-forget post-commit and
 * have no reconciliation path, so without a retry a single transient D1 blip
 * leaves the D1 read-model permanently stale (a lying "your turn" badge, a
 * frozen lobby countdown) until the next transition happens to overwrite it.
 *
 * This is the retry Cloudflare documents for the case — exponential backoff,
 * a max-delay cap, and jitter — with the crucial narrow predicate: only
 * transient infrastructure errors are retried, never a deterministic failure
 * that would just burn the budget before surfacing.
 */

import { matchesCause } from "./errors.js";

/** The transient D1 failures Cloudflare's debug-D1 docs mark "Retry the
 * operation": a network blip, a storage/Durable-Object reset, a code-update
 * restart, or a transient routing failure. This mirrors Cloudflare's own
 * reference `withRetry` (D1 read-replication tutorial), which matches the first
 * three by substring — string matching IS the idiomatic path here, because D1
 * exposes no structured error code (its "error constants" are themselves just
 * message prefixes).
 *
 * Two deliberate departures from the reference snippet:
 *
 * - Walked down the `cause` chain, not just the top message — via the shared
 *   `matchesCause` (`d1/errors.ts`), which documents why a flat
 *   `error.message` check would miss every one of these in this codebase.
 * - Overload (`D1 DB is overloaded`) and resource resets (memory/CPU limit)
 *   are NOT here. The docs' remedy for those is to shed load, not retry —
 *   hammering an overloaded DB is backwards, and doubly so for a cosmetic
 *   fire-and-forget mirror write. Deterministic failures (constraint/type/
 *   missing-column) are excluded for the same "retrying only delays the
 *   report" reason. */
const RETRYABLE_D1 = [/Network connection lost/i, /caused object to be reset/i, /reset because its code was updated/i, /Cannot resolve D1 DB/i];

/**
 * True for the D1 failures worth retrying — a network blip, a storage or
 * Durable-Object reset, a code-update restart, or a transient routing failure.
 *
 * Deliberately narrow. Overload and resource-limit errors are excluded (the
 * remedy is to shed load, not retry), as are deterministic failures such as a
 * constraint or type error, where retrying only delays the report. The whole
 * `cause` chain is examined, because drizzle rewraps failures in its own
 * message that does not carry the underlying text.
 *
 * This is the default predicate for {@link withRetry}; pass
 * `shouldRetry` to override it.
 */
export function isTransientD1Error(error: unknown): boolean {
  return matchesCause(error, ...RETRYABLE_D1);
}

export interface RetryOptions {
  /** Total attempts including the first. Default 4. */
  attempts?: number;
  /** First backoff, doubling each retry. Default 50ms. */
  baseDelayMs?: number;
  /** Backoff ceiling. Default 2000ms. */
  maxDelayMs?: number;
  /** Which failures are worth retrying. Default {@link isTransientD1Error}. */
  shouldRetry?: (error: unknown) => boolean;
  /** Observe each retry (logging); never throws into the loop. */
  onRetry?: (error: unknown, attempt: number) => void;
  /** Delay primitive, injectable so tests run without real timers. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run `op`, retrying a *retryable* failure with jittered exponential backoff up
 * to `attempts`. A non-retryable failure — or the last attempt — throws.
 *
 * Safe to leave unawaited inside a Durable Object: the DO stays alive while the
 * returned promise (and its backoff timers) is pending, so the whole sequence
 * runs to completion without `waitUntil`, exactly like the single-attempt
 * writes it wraps.
 *
 * `op` MUST be idempotent — a retry can fire after a write that actually
 * landed but whose acknowledgement was lost.
 */
export async function withRetry<T>(op: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 4;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const shouldRetry = options.shouldRetry ?? isTransientD1Error;
  const sleep = options.sleep ?? defaultSleep;
  let delay = options.baseDelayMs ?? 50;

  for (let attempt = 1; ; attempt++) {
    try {
      return await op();
    } catch (error) {
      if (attempt >= attempts || !shouldRetry(error)) throw error;
      options.onRetry?.(error, attempt);
      // Jitter: wait a random point in [delay, 2·delay) so concurrent DOs
      // recovering from the same blip do not resynchronise onto one instant.
      await sleep(delay * (1 + Math.random()));
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }
}
