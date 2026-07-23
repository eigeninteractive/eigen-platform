/**
 * Per-user write rate limiting. The suite's worker wires a deterministic
 * in-memory limiter (see `worker.ts`) that enforces ONLY for keys containing
 * the sentinel `ratelimit`, allowing two calls per (limiter, user) before it
 * refuses — so these tests mint users whose id carries the sentinel and the
 * third call to each limited endpoint is a 429. Every other caller is
 * unlimited, which is what keeps the rest of the suite (and the "unlimited
 * caller" case below) unaffected.
 *
 * What is asserted is the engine's wiring: each limited route calls the limiter
 * with the caller's id and, on refusal, answers the shared `rate_limited` 429
 * with a `Retry-After`. The real `ratelimit` binding's accuracy is Cloudflare's
 * concern, not the engine's, so it is deliberately not exercised here.
 */

import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { testBearer as bearer, type TestTokenOptions } from "../src/testing.js";

const rnd = () => crypto.randomUUID().slice(0, 8);

async function api(opts: TestTokenOptions, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: { ...(await bearer(opts)), "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

/** A registered user whose id carries the `ratelimit` sentinel, so the fake
 * limiter enforces against it. */
async function limitedUser(tag: string): Promise<TestTokenOptions> {
  const opts: TestTokenOptions = { uid: `ratelimit-${tag}-${rnd()}`, email: `${tag}${rnd()}@e.com`, name: `${tag} Person` };
  expect((await api(opts, "GET", "/me")).status).toBe(200);
  return opts;
}

async function expect429(res: Response, retryAfter: string): Promise<void> {
  expect(res.status).toBe(429);
  expect(((await res.json()) as { code: string }).code).toBe("rate_limited");
  expect(res.headers.get("retry-after")).toBe(retryAfter);
}

const createBody = { access: "public" as const, schema_version: 1, config: { target: 3 }, min_players: 2, max_players: 2, rated: false };

describe("rate limiting — the third call trips", () => {
  it("game creation (Retry-After 60)", async () => {
    const u = await limitedUser("create");
    expect((await api(u, "POST", "/games", createBody)).status).toBe(201);
    expect((await api(u, "POST", "/games", createBody)).status).toBe(201);
    await expect429(await api(u, "POST", "/games", createBody), "60");
  });

  it("friend requests (Retry-After 60)", async () => {
    const u = await limitedUser("friend");
    const target = await limitedUser("target"); // a distinct sentinel user, but the limiter keys on the caller
    // Two calls land (requested, then already_pending); the third is refused
    // before the request logic runs.
    expect((await api(u, "POST", "/friends/requests", { target_user_id: target.uid })).status).toBe(200);
    expect((await api(u, "POST", "/friends/requests", { target_user_id: target.uid })).status).toBe(200);
    await expect429(await api(u, "POST", "/friends/requests", { target_user_id: target.uid }), "60");
  });

  it("user search (Retry-After 10)", async () => {
    const u = await limitedUser("search");
    expect((await api(u, "GET", "/users/search?q=someone")).status).toBe(200);
    expect((await api(u, "GET", "/users/search?q=someone")).status).toBe(200);
    await expect429(await api(u, "GET", "/users/search?q=someone"), "10");
  });

  it("avatar upload (Retry-After 60)", async () => {
    const u = await limitedUser("avatar");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const put = async () => await exports.default.fetch("https://x/api/engine/me/avatar", { method: "PUT", headers: { ...(await bearer(u)), "content-type": "image/png" }, body: png });
    expect((await put()).status).toBe(200);
    expect((await put()).status).toBe(200);
    await expect429(await put(), "60");
  });
});

describe("rate limiting — a normal caller is unlimited", () => {
  it("lets a non-sentinel user create well past the sentinel threshold", async () => {
    const opts: TestTokenOptions = { uid: `plain-${rnd()}`, email: `p${rnd()}@e.com`, name: "Plain" };
    expect((await api(opts, "GET", "/me")).status).toBe(200);
    for (let i = 0; i < 5; i++) {
      expect((await api(opts, "POST", "/games", createBody)).status).toBe(201);
    }
  });
});
