/**
 * auth suite: the jose verifier (unit, against the local JWKS) and the D1
 * user provisioning through the live middleware (`/api/engine/me` over the worker).
 */

import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { issueSocketTicket, verifySocketTicket } from "../src/auth/socket-ticket.js";
import { AuthError } from "../src/index.js";
import { testBearer as bearer, mintTestToken as mintToken, testVerifier } from "../src/testing.js";

const verifier = testVerifier();

let uidCounter = 0;
function freshUid(): string {
  return `uid-${++uidCounter}-${crypto.randomUUID()}`;
}

describe("createFirebaseVerifier", () => {
  it("verifies a valid token and extracts the Firebase claims", async () => {
    const token = await mintToken({ uid: "u1", email: "a@example.com", name: "Alice", picture: "https://p/a.png" });
    const claims = await verifier.verify(token);
    expect(claims).toEqual({ uid: "u1", isAnonymous: false, email: "a@example.com", name: "Alice", picture: "https://p/a.png" });
  });

  it("flags the anonymous sign-in provider", async () => {
    const claims = await verifier.verify(await mintToken({ uid: "u2", anonymous: true }));
    expect(claims.isAnonymous).toBe(true);
    expect(claims.email).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = await mintToken({ uid: "u3", claims: { exp: Math.floor(Date.now() / 1000) - 60 } });
    await expect(verifier.verify(token)).rejects.toThrow(AuthError);
  });

  it("rejects a wrong audience and a wrong issuer", async () => {
    await expect(verifier.verify(await mintToken({ uid: "u4", claims: { aud: "other-project" } }))).rejects.toThrow(AuthError);
    await expect(verifier.verify(await mintToken({ uid: "u4", claims: { iss: "https://evil.example" } }))).rejects.toThrow(AuthError);
  });
});

describe("socket tickets", () => {
  const secret = "test-socket-ticket-secret-at-least-32-characters";
  const now = new Date("2026-08-20T00:00:00.000Z");

  it("is bound to the authenticated user and one game", async () => {
    const ticket = await issueSocketTicket(secret, { gameId: "game-a", userId: "user-a" }, now);
    await expect(verifySocketTicket(secret, ticket, "game-a", now)).resolves.toEqual({ gameId: "game-a", userId: "user-a" });
    await expect(verifySocketTicket(secret, ticket, "game-b", now)).rejects.toThrow();
    await expect(verifySocketTicket(`${secret}-wrong`, ticket, "game-a", now)).rejects.toThrow();
  });

  it("expires after its short lifetime", async () => {
    const ticket = await issueSocketTicket(secret, { gameId: "game-a", userId: "user-a" }, now);
    await expect(verifySocketTicket(secret, ticket, "game-a", new Date(now.getTime() + 61_000))).rejects.toThrow();
  });
});

describe("middleware + provisioning", () => {
  it("answers trusted browser preflights before auth and rejects unknown origins", async () => {
    const allowed = await exports.default.fetch("https://x/api/engine/me", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("https://app.example");
    expect(allowed.headers.get("access-control-allow-headers")).toContain("Authorization");

    const denied = await exports.default.fetch("https://x/api/engine/me", {
      method: "OPTIONS",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "GET",
      },
    });
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("401s without a token and with garbage", async () => {
    expect((await exports.default.fetch("https://x/api/engine/me")).status).toBe(401);
    expect((await exports.default.fetch("https://x/api/engine/me", { headers: { authorization: "Bearer nope" } })).status).toBe(401);
  });

  it("provisions a users row on first sight, idempotently, deriving the handle from the email", async () => {
    const uid = freshUid();
    const headers = await bearer({ uid, email: "Bob.Smith+games@example.com", name: "Bob" });
    const first = await exports.default.fetch("https://x/api/engine/me", { headers });
    expect(first.status).toBe(200);
    const profile = (await first.json()) as { id: string; username: string; displayName: string; email: string | null; isAnonymous: boolean };
    expect(profile.id).toBe(uid);
    // Sanitised local part: lowercased, restricted to [a-z0-9_.].
    expect(profile.username).toBe("bob.smithgames");
    expect(profile.displayName).toBe("Bob");
    expect(profile.email).toBe("Bob.Smith+games@example.com");
    expect(profile.isAnonymous).toBe(false);

    const again = (await (await exports.default.fetch("https://x/api/engine/me", { headers })).json()) as { username: string };
    expect(again.username).toBe(profile.username);
  });

  it("suffixes the handle on collision; guests get a generated one", async () => {
    const one = (await (await exports.default.fetch("https://x/api/engine/me", { headers: await bearer({ uid: freshUid(), email: "alice@a.com" }) })).json()) as { username: string };
    expect(one.username).toBe("alice");
    // Same local part, different provider account: retry appends 4 digits.
    const two = (await (await exports.default.fetch("https://x/api/engine/me", { headers: await bearer({ uid: freshUid(), email: "alice@b.com" }) })).json()) as { username: string };
    expect(two.username).toMatch(/^alice_\d{4}$/);

    const guest = (await (await exports.default.fetch("https://x/api/engine/me", { headers: await bearer({ uid: freshUid(), anonymous: true }) })).json()) as { username: string };
    expect(guest.username).toMatch(/^player_\d{5}$/);
  });

  it("backfills on guest → permanent conversion, preserving uid and handle; the provider identity overwrites", async () => {
    const uid = freshUid();
    const guest = (await (await exports.default.fetch("https://x/api/engine/me", { headers: await bearer({ uid, anonymous: true }) })).json()) as { username: string; isAnonymous: boolean; email: string | null };
    expect(guest.isAnonymous).toBe(true);
    expect(guest.email).toBeNull();

    const converted = (await (await exports.default.fetch("https://x/api/engine/me", { headers: await bearer({ uid, email: "c@example.com", name: "Cara", picture: "https://p/c.png" }) })).json()) as { username: string; isAnonymous: boolean; email: string | null; displayName: string; avatarUrl: string | null };
    expect(converted.isAnonymous).toBe(false);
    expect(converted.email).toBe("c@example.com");
    // Product decision: the provider's name and avatar overwrite.
    expect(converted.displayName).toBe("Cara");
    expect(converted.avatarUrl).toBe("https://p/c.png");
    // Same row: the guest's generated handle stays the stable username.
    expect(converted.username).toBe(guest.username);
  });
});
