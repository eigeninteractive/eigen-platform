/**
 * Per-user rate limiting for the write endpoints that are cheap to spam and
 * expensive (or abusive) in bulk. Backed by the Workers `ratelimit` binding.
 *
 * The engine owns the WIRING, not the numbers. The platform enforces the
 * `limit`/`period` written in `wrangler.jsonc` (Worker code can neither set nor
 * read those) so the numbers live there, once, per app. What the engine owns is
 * the set of limiters ({@link RateLimitName}) and the conventional binding name
 * for each ({@link RATE_LIMIT_BINDING}): an app declares a `ratelimits` entry
 * under each name and rate limiting is on, with nothing to wire in code. The
 * names are `EIGEN_`-prefixed so an engine binding never collides with one the
 * game defines. `namespace_id` is the app's to choose: it must be a positive
 * integer and is account-scoped, so two Workers sharing an id share counters; a
 * shared engine constant could not pick ids unique within each account. A name
 * bound nowhere is unlimited, which is the local/dev/test default.
 *
 * The binding is per-colo, eventually consistent, and, in Cloudflare's own
 * words, "not an accounting system": an abuse dampener, not a hard quota.
 * Reads are never limited; a popular public read (an avatar, a lobby page) is a
 * caching problem, and rejecting legitimate callers would be the wrong tool.
 *
 * Keys are always the caller's stable user id (never an IP, since many legitimate
 * users share one, per Cloudflare's guidance).
 */

import { HttpError } from "./http.js";

/** The logical limiters the engine enforces, one per write surface. */
export type RateLimitName = "avatar_upload" | "game_create" | "friend_request" | "user_search";

/** The conventional Wrangler binding name for each limiter. The engine resolves
 * these off `env`, so declaring a `ratelimits` entry under each name is the
 * whole setup. `EIGEN_`-prefixed to stay clear of app-defined bindings. */
export const RATE_LIMIT_BINDING: Record<RateLimitName, string> = {
  avatar_upload: "EIGEN_RATE_LIMIT_AVATAR_UPLOAD",
  game_create: "EIGEN_RATE_LIMIT_GAME_CREATE",
  friend_request: "EIGEN_RATE_LIMIT_FRIEND_REQUEST",
  user_search: "EIGEN_RATE_LIMIT_USER_SEARCH",
};

/** Advisory `Retry-After` (seconds) on a 429. Flat and conservative on purpose:
 * the engine cannot read the binding's configured window, so it does not
 * pretend to: one sensible "wait a bit" beats a per-limiter guess that goes
 * stale the moment an app tunes a `period`. */
export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

/** The one method the engine calls on a resolved limiter. The Workers
 * `RateLimit` binding is structurally this, so a binding passes straight
 * through; declaring the shape here keeps the engine off the ambient platform
 * type and documents exactly what is used. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Whether an env value is a usable limiter: the structural test the resolver
 * uses before treating a binding as one. */
export function isRateLimiter(value: unknown): value is RateLimiter {
  return typeof value === "object" && value !== null && typeof (value as RateLimiter).limit === "function";
}

/** Resolve the limiter for a name off `env` by its conventional binding name,
 * or null when the app did not bind it (unlimited, the dev/test default). */
export function resolveRateLimiter(env: unknown, name: RateLimitName): RateLimiter | null {
  const binding = (env as Record<string, unknown>)[RATE_LIMIT_BINDING[name]];
  return isRateLimiter(binding) ? binding : null;
}

/** Enforce a limiter if one is bound, else do nothing. On rejection, throws the
 * 429 `rateLimited` the app's error handler renders, with a `Retry-After`.
 * Call before doing the endpoint's real work. */
export async function enforceRateLimit(env: unknown, name: RateLimitName, key: string): Promise<void> {
  const limiter = resolveRateLimiter(env, name);
  if (limiter === null) return;
  const { success } = await limiter.limit({ key });
  if (!success) {
    throw new HttpError(429, "Too many requests in a short window. Slow down and try again.", "rateLimited", RATE_LIMIT_RETRY_AFTER_SECONDS);
  }
}
