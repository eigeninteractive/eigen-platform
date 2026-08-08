/**
 * Rate limiting is a small pure surface: resolve the limiter for a name off env
 * by its conventional binding, and enforce it (throw the shared 429 on
 * refusal). The local runtime does not implement the `ratelimit` binding, so
 * there is nothing real to integration-test, so these unit-test the logic
 * directly with a fake limiter, which is exactly what the routes and
 * `createEngine` call.
 */

import { describe, expect, it } from "vitest";
import { HttpError } from "../src/http.js";
import { enforceRateLimit, isRateLimiter, RATE_LIMIT_BINDING, type RateLimiter, resolveRateLimiter } from "../src/rate-limit.js";

/** A limiter that allows the first `allow` calls, then refuses. */
function fakeLimiter(allow: number): RateLimiter {
  let seen = 0;
  return { limit: async () => ({ success: ++seen <= allow }) };
}

async function catchError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
    return undefined;
  } catch (e) {
    return e;
  }
}

describe("RATE_LIMIT_BINDING convention", () => {
  it("names a distinct, EIGEN_-prefixed binding for exactly the known limiters", () => {
    expect(Object.keys(RATE_LIMIT_BINDING).sort()).toEqual(["avatar_upload", "friend_request", "game_create", "user_search"]);
    const names = Object.values(RATE_LIMIT_BINDING);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.startsWith("EIGEN_")).toBe(true);
  });
});

describe("isRateLimiter", () => {
  it("accepts a limit()-bearing object and rejects anything else", () => {
    expect(isRateLimiter({ limit: async () => ({ success: true }) })).toBe(true);
    expect(isRateLimiter(undefined)).toBe(false);
    expect(isRateLimiter(null)).toBe(false);
    expect(isRateLimiter({})).toBe(false);
    expect(isRateLimiter("EIGEN_RATE_LIMIT_USER_SEARCH")).toBe(false);
  });
});

describe("resolveRateLimiter", () => {
  it("finds the limiter under the conventional binding name", () => {
    const limiter = fakeLimiter(1);
    const env = { [RATE_LIMIT_BINDING.game_create]: limiter };
    expect(resolveRateLimiter(env, "game_create")).toBe(limiter);
  });

  it("returns null when the name is unbound (unlimited, the dev default)", () => {
    expect(resolveRateLimiter({}, "avatar_upload")).toBeNull();
  });

  it("returns null when the binding is not a limiter", () => {
    const env = { [RATE_LIMIT_BINDING.user_search]: "not-a-limiter" };
    expect(resolveRateLimiter(env, "user_search")).toBeNull();
  });
});

describe("enforceRateLimit", () => {
  it("does nothing when the name is unbound", async () => {
    expect(await catchError(() => enforceRateLimit({}, "friend_request", "u1"))).toBeUndefined();
  });

  it("passes while under the limit, then throws a 429 rateLimited with Retry-After", async () => {
    const env = { [RATE_LIMIT_BINDING.game_create]: fakeLimiter(2) };
    expect(await catchError(() => enforceRateLimit(env, "game_create", "u1"))).toBeUndefined();
    expect(await catchError(() => enforceRateLimit(env, "game_create", "u1"))).toBeUndefined();

    const error = await catchError(() => enforceRateLimit(env, "game_create", "u1"));
    expect(error).toBeInstanceOf(HttpError);
    const http = error as HttpError;
    expect(http.status).toBe(429);
    expect(http.code).toBe("rateLimited");
    expect(http.retryAfterSeconds).toBe(60);
  });
});
