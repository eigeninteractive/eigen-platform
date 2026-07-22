/**
 * The public web surface (deep links avatars): the
 * generated `.well-known` files, the `/j/:shortCode` share page, and the
 * avatar upload/serve/purge round trip against a locally-simulated R2 bucket.
 */

import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { testBearer as bearer } from "../src/testing.js";

const uid = (tag: string) => `${tag}-${crypto.randomUUID()}`;

async function api(id: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: { ...(await bearer({ uid: id })), "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const createBody = { access: "public" as const, schema_version: 1, config: { target: 3 }, min_players: 2, max_players: 2, rated: false };

describe("deep-link well-known", () => {
  it("generates assetlinks.json from config, as JSON", async () => {
    const res = await exports.default.fetch("https://x/.well-known/assetlinks.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { target: { package_name: string; sha256_cert_fingerprints: string[] } }[];
    expect(body[0]?.target.package_name).toBe("com.eigen.test");
    expect(body[0]?.target.sha256_cert_fingerprints).toContain("AA:BB:CC");
  });

  it("generates the (extensionless) AASA as JSON with the appID and /j path", async () => {
    const res = await exports.default.fetch("https://x/.well-known/apple-app-site-association");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { applinks: { details: { appID: string; paths: string[] }[] } };
    expect(body.applinks.details[0]?.appID).toBe("TEAMID1234.com.eigen.test");
    expect(body.applinks.details[0]?.paths).toContain("/j/*");
  });
});

describe("share/landing page", () => {
  it("renders OG tags + store links for a real invite code", async () => {
    const a = uid("host");
    const { short_code } = (await (await api(a, "POST", "/games", createBody)).json()) as { short_code: string };

    const res = await exports.default.fetch(`https://x/j/${short_code}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('property="og:title"');
    expect(html).toContain("seat"); // "1 seat open" (max 2, one seated)
    expect(html).toContain("https://apps.apple.com/app/id000000000");
    expect(html).toContain("https://play.google.com/store/apps/details?id=com.eigen.test");
  });

  it("returns a 404 page for an unknown code", async () => {
    const res = await exports.default.fetch("https://x/j/ZZZZZZ");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});

describe("avatars", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

  async function upload(id: string, contentType: string, body: BodyInit): Promise<Response> {
    return await exports.default.fetch("https://x/api/engine/me/avatar", { method: "PUT", headers: { ...(await bearer({ uid: id })), "content-type": contentType }, body });
  }

  it("uploads, records a versioned URL, and serves the bytes publicly", async () => {
    const a = uid("av");
    const up = await upload(a, "image/png", png);
    expect(up.status).toBe(200);
    const { avatar_url } = (await up.json()) as { avatar_url: string };
    expect(avatar_url).toMatch(new RegExp(`^/avatars/${a}\\?v=\\d+$`));

    // /me reflects the stored URL.
    const me = (await (await api(a, "GET", "/me")).json()) as { avatar_url: string };
    expect(me.avatar_url).toBe(avatar_url);

    // Public serve — no auth, right content type, immutable cache.
    const served = await exports.default.fetch(`https://x${avatar_url}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect(served.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(png);
  });

  it("rejects a non-image type, an empty body, and an oversized image", async () => {
    const a = uid("av");
    expect((await upload(a, "application/pdf", png)).status).toBe(415);
    expect((await upload(a, "image/png", new Uint8Array(0))).status).toBe(400);
    expect((await upload(a, "image/png", new Uint8Array(5000))).status).toBe(413); // maxBytes 4096
  });

  it("deletes the avatar object when the account is deleted", async () => {
    const a = uid("av");
    const { avatar_url } = (await (await upload(a, "image/png", png)).json()) as { avatar_url: string };
    expect((await exports.default.fetch(`https://x${avatar_url}`)).status).toBe(200);

    expect((await api(a, "DELETE", "/me")).status).toBe(204);
    expect((await exports.default.fetch(`https://x${avatar_url}`)).status).toBe(404);
  });
});

describe("health", () => {
  it("answers 200 with no auth and no caching", async () => {
    const res = await exports.default.fetch("https://x/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    // Must not be cacheable — a cached 200 would keep reporting healthy after
    // the worker stopped being able to serve.
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("discloses nothing about configuration", async () => {
    const body = await (await exports.default.fetch("https://x/health")).text();
    // The whole body is the literal status. No project id, no feature flags,
    // no version — anything more is a config leak on an unauthed route.
    expect(body).toBe('{"status":"ok"}');
  });

  it("needs no auth header at all", async () => {
    // Explicitly not just "unauthenticated works" — a bad token must not turn
    // liveness into a 401, or a monitor reports an outage that isn't one.
    const res = await exports.default.fetch("https://x/health", { headers: { authorization: "Bearer garbage" } });
    expect(res.status).toBe(200);
  });
});
