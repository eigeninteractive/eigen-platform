/**
 * Per-user rate limiting for the write endpoints that are cheap to spam and
 * expensive (or abusive) in bulk. Backed by the Workers `ratelimit` binding.
 *
 * The engine owns the policy: the default limit for every surface lives here in
 * {@link RATE_LIMIT_DEFAULTS}, and the engine resolves a binding by the
 * convention in {@link RATE_LIMIT_BINDING} — so an implementor pastes the block
 * from {@link defaultRateLimitsConfig} into their Wrangler config once and rate
 * limiting is on, with no `createEngine` wiring and no numbers to invent. A
 * different backing (shared bindings, per-env limits) is still possible by
 * supplying `EngineConfig.rateLimit`; a name left unbound is simply unlimited,
 * which is the local/dev/test default.
 *
 * The binding is per-colo, eventually consistent, and — in Cloudflare's own
 * words — "not an accounting system": it is an abuse dampener, not a hard
 * quota. That is exactly the intent here. Reads are never limited; a popular
 * public read (an avatar, a lobby page) is a caching problem, not a limiting
 * one, and rejecting legitimate callers would be the wrong tool.
 *
 * Keys are always the caller's stable user id (never an IP — many legitimate
 * users share one, per Cloudflare's guidance).
 */

import type { RouteContext } from "./engine.js";
import { HttpError } from "./http.js";

/** The logical limiters the engine enforces, one per write surface. */
export type RateLimitName = "avatar_upload" | "game_create" | "friend_request" | "user_search";

/** A single limiter's policy — the shape of the `ratelimit` binding's `simple`
 * block. `period` is 10 or 60 (the only values the platform accepts). */
export interface RateLimitRule {
  limit: number;
  period: 10 | 60;
}

/** The engine's default limit for every surface — the single source of truth,
 * used both to build the Wrangler block ({@link defaultRateLimitsConfig}) and
 * to advise `Retry-After`. An implementor overrides a value by editing the
 * `simple` block they pasted, or replaces the wiring wholesale with
 * `EngineConfig.rateLimit`. */
export const RATE_LIMIT_DEFAULTS: Record<RateLimitName, RateLimitRule> = {
  avatar_upload: { limit: 5, period: 60 },
  game_create: { limit: 10, period: 60 },
  friend_request: { limit: 20, period: 60 },
  user_search: { limit: 20, period: 10 },
};

/** The conventional Wrangler binding name for each limiter. When an app does
 * not supply its own `EngineConfig.rateLimit`, the engine looks these up on
 * `env` — so pasting {@link defaultRateLimitsConfig} is the entire setup. */
export const RATE_LIMIT_BINDING: Record<RateLimitName, string> = {
  avatar_upload: "RATE_LIMIT_AVATAR_UPLOAD",
  game_create: "RATE_LIMIT_GAME_CREATE",
  friend_request: "RATE_LIMIT_FRIEND_REQUEST",
  user_search: "RATE_LIMIT_USER_SEARCH",
};

/** One entry of a Wrangler `ratelimits` array. */
export interface WranglerRateLimit {
  name: string;
  namespace_id: string;
  simple: RateLimitRule;
}

/** The canonical `ratelimits` array for `wrangler.jsonc`, built from the engine
 * defaults. Paste the result under `"ratelimits"`; the engine wires it
 * automatically via {@link RATE_LIMIT_BINDING}. Edit a `simple` value to
 * override that limiter. Namespace ids are arbitrary but must be stable and
 * distinct, so each limiter counts independently. */
export function defaultRateLimitsConfig(): WranglerRateLimit[] {
  return (Object.keys(RATE_LIMIT_DEFAULTS) as RateLimitName[]).map((name, i) => ({
    name: RATE_LIMIT_BINDING[name],
    namespace_id: String(1001 + i),
    simple: RATE_LIMIT_DEFAULTS[name],
  }));
}

/** The one method the engine calls on a resolved limiter. The Workers
 * `RateLimit` binding is structurally this, so an app's binding passes straight
 * through; declaring the shape here keeps the engine off the ambient platform
 * type and documents exactly what is used. */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Whether an env value is a usable limiter — the structural test the
 * convention resolver uses before treating a binding as one. */
export function isRateLimiter(value: unknown): value is RateLimiter {
  return typeof value === "object" && value !== null && typeof (value as RateLimiter).limit === "function";
}

/** Enforce a limiter if one is configured, else do nothing. On rejection,
 * throws the 429 `rate_limited` the app's error handler renders, with a
 * `Retry-After` of the limiter's window (a `period`-second wait clears a fixed
 * window). Call before doing the endpoint's real work. */
export async function enforceRateLimit(ctx: RouteContext, env: unknown, name: RateLimitName, key: string): Promise<void> {
  const limiter = ctx.rateLimit(env, name);
  if (limiter === null) return;
  const { success } = await limiter.limit({ key });
  if (!success) {
    throw new HttpError(429, "Too many requests in a short window — slow down and try again.", "rate_limited", RATE_LIMIT_DEFAULTS[name].period);
  }
}
