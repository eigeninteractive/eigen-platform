/**
 * The public web surface (deep links avatars): the
 * generated `.well-known` files, the `/join/:shortCode` share page, and the
 * avatar upload/serve/purge round trip against a locally-simulated R2 bucket.
 */

import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { renderFlutterShell } from "../src/site/flutter-shell.js";
import { testBearer as bearer } from "../src/testing.js";

const uid = (tag: string) => `${tag}-${crypto.randomUUID()}`;

async function api(id: string, method: string, path: string, body?: unknown): Promise<Response> {
  return await exports.default.fetch(`https://x/api/engine${path}`, {
    method,
    headers: { ...(await bearer({ uid: id })), "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const createBody = { access: "public" as const, schemaVersion: 1, config: { target: 3 }, minPlayers: 2, maxPlayers: 2, rated: false };

describe("deep-link well-known", () => {
  it("generates assetlinks.json from config, as JSON", async () => {
    const res = await exports.default.fetch("https://x/.well-known/assetlinks.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { target: { package_name: string; sha256_cert_fingerprints: string[] } }[];
    expect(body[0]?.target.package_name).toBe("com.eigen.test");
    expect(body[0]?.target.sha256_cert_fingerprints).toContain("AA:BB:CC");
  });

  it("generates the (extensionless) AASA as JSON with the appID and app paths", async () => {
    const res = await exports.default.fetch("https://x/.well-known/apple-app-site-association");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { applinks: { details: { appID: string; paths: string[] }[] } };
    expect(body.applinks.details[0]?.appID).toBe("TEAMID1234.com.eigen.test");
    expect(body.applinks.details[0]?.paths).toContain("/join/*");
    // The app also claims `/game/*` (replay + push deep links); legal paths are
    // deliberately absent so the OS never intercepts them.
    expect(body.applinks.details[0]?.paths).toContain("/game/*");
  });
});

describe("share/landing page", () => {
  it("renders OG tags + store links for a real invite code", async () => {
    const a = uid("host");
    const { shortCode } = (await (await api(a, "POST", "/games", createBody)).json()) as { shortCode: string };

    const res = await exports.default.fetch(`https://x/join/${shortCode}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('property="og:title"');
    expect(html).toContain("seat"); // "1 seat open" (max 2, one seated)
    expect(html).toContain("https://apps.apple.com/app/id000000000");
    expect(html).toContain("https://play.google.com/store/apps/details?id=com.eigen.test");
  });

  it("returns a 404 page for an unknown code", async () => {
    const res = await exports.default.fetch("https://x/join/ZZZZZZ");
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});

describe("Flutter web share shell", () => {
  it("serves the app shell with dynamic, escaped metadata and no caching", async () => {
    const assets = {
      fetch: async () =>
        new Response('<!doctype html><html><head><meta name="description" content="old"><meta property="og:title" content="stale"><link rel="canonical" href="https://old.example"><title>Old</title></head><body><script src="/main.dart.js"></script></body></html>', { headers: { "Content-Type": "text/html" } }),
    } as unknown as Fetcher;
    const response = await renderFlutterShell(new Request("https://game.example/join/ABC123?utm_source=chat"), assets, {
      title: 'Join "A & B"',
      description: "One <seat> open",
      siteName: "Example Game",
    });

    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain('<title>Join "A &amp; B"</title>');
    expect(html).toContain('content="One &lt;seat&gt; open"');
    expect(html).toContain('property="og:url" content="https://game.example/join/ABC123"');
    expect(html).not.toContain("utm_source");
    expect(html).toContain('name="twitter:card" content="summary"');
    expect(html).toContain('name="twitter:title" content="Join &quot;A &amp; B&quot;"');
    expect(html).not.toContain("stale");
    expect(html).not.toContain("old.example");
    expect(html).toContain('href="/download"');
    expect(html).toContain('src="/main.dart.js"');
  });

  it("uses a large Twitter card only when an image exists", async () => {
    const assets = {
      fetch: async () => new Response("<html><head><title>Old</title></head><body></body></html>"),
    } as unknown as Fetcher;
    const response = await renderFlutterShell(new Request("https://game.example/game/1"), assets, {
      title: "Game",
      description: "Watch this game.",
      siteName: "Example Game",
      image: "https://game.example/og.png",
    });

    expect(await response.text()).toContain('name="twitter:card" content="summary_large_image"');
  });

  it("fails loudly when a configured asset binding cannot serve index.html", async () => {
    const assets = {
      fetch: async () => new Response("Not found", { status: 404 }),
    } as unknown as Fetcher;

    await expect(
      renderFlutterShell(new Request("https://game.example/game/1"), assets, {
        title: "Game",
        description: "Watch this game.",
        siteName: "Example Game",
      }),
    ).rejects.toThrow("Flutter web assets could not serve /index.html (status 404)");
  });
});

describe("game landing page", () => {
  it("renders OG tags, the roster, and store links for a public game", async () => {
    const a = uid("gh");
    const { gameId } = (await (await api(a, "POST", "/games", createBody)).json()) as { gameId: string };

    const res = await exports.default.fetch(`https://x/game/${gameId}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('property="og:title"');
    // A public game names its roster (the single seated human so far).
    expect(html).toContain("Watch this game");
    expect(html).toContain("https://apps.apple.com/app/id000000000");
  });

  it("does not leak the roster of a private game", async () => {
    const a = uid("gp");
    const displayName = (await (await api(a, "GET", "/me")).json()) as { displayName?: string };
    const { gameId } = (await (await api(a, "POST", "/games", { ...createBody, access: "private" })).json()) as { gameId: string };

    const html = await (await exports.default.fetch(`https://x/game/${gameId}`)).text();
    expect(html).toContain("Open this game in"); // the generic card
    expect(html).not.toContain("Watch this game"); // no roster description
    // The seated player's name must not appear on an unauthenticated page.
    if (displayName.displayName !== undefined) expect(html).not.toContain(displayName.displayName);
  });

  it("returns a 404 page for an unknown game id", async () => {
    const res = await exports.default.fetch("https://x/game/does-not-exist");
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
    const { avatarUrl } = (await up.json()) as { avatarUrl: string };
    expect(avatarUrl).toMatch(new RegExp(`^/avatars/${a}\\?v=\\d+$`));

    // /me reflects the stored URL.
    const me = (await (await api(a, "GET", "/me")).json()) as { avatarUrl: string };
    expect(me.avatarUrl).toBe(avatarUrl);

    // Public serve: no auth, right content type, immutable cache.
    const served = await exports.default.fetch(`https://x${avatarUrl}`);
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

  it("serves a repeat read from the edge cache, surviving the underlying object", async () => {
    const a = uid("cache");
    const { avatarUrl } = (await (await upload(a, "image/png", png)).json()) as { avatarUrl: string };

    // First read populates the Worker's edge cache (via waitUntil).
    const first = await exports.default.fetch(`https://x${avatarUrl}`);
    expect(first.status).toBe(200);
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(png);

    // Remove the object out of band. A read of a DIFFERENT (uncached) URL for
    // the same uid now 404s, proof R2 is genuinely empty...
    await env.AVATARS.delete(a);
    expect((await exports.default.fetch(`https://x/avatars/${a}?v=0`)).status).toBe(404);

    // ...yet the original versioned URL still serves the bytes: it came from
    // the cache, never R2. (This is exactly why account deletion must
    // invalidate the entry; see the next test.)
    const second = await exports.default.fetch(`https://x${avatarUrl}`);
    expect(second.status).toBe(200);
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(png);
  });

  it("deletes the avatar object when the account is deleted", async () => {
    const a = uid("av");
    const { avatarUrl } = (await (await upload(a, "image/png", png)).json()) as { avatarUrl: string };
    expect((await exports.default.fetch(`https://x${avatarUrl}`)).status).toBe(200);

    expect((await api(a, "DELETE", "/me")).status).toBe(204);
    expect((await exports.default.fetch(`https://x${avatarUrl}`)).status).toBe(404);
  });
});

describe("health", () => {
  it("answers 200 with no auth and no caching", async () => {
    const res = await exports.default.fetch("https://x/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    // Must not be cacheable: a cached 200 would keep reporting healthy after
    // the worker stopped being able to serve.
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("discloses nothing about configuration", async () => {
    const body = await (await exports.default.fetch("https://x/health")).text();
    // The whole body is the literal status. No project id, no feature flags,
    // no version. Anything more is a config leak on an unauthed route.
    expect(body).toBe('{"status":"ok"}');
  });

  it("needs no auth header at all", async () => {
    // Explicitly not just "unauthenticated works": a bad token must not turn
    // liveness into a 401, or a monitor reports an outage that isn't one.
    const res = await exports.default.fetch("https://x/health", { headers: { authorization: "Bearer garbage" } });
    expect(res.status).toBe(200);
  });
});
