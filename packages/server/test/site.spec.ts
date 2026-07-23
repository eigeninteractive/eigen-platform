/**
 * The game's public web surface: the landing page, the three legal documents,
 * and the crawler files, all generated from `site` config.
 *
 * The integration half drives the real worker (see `test/worker.ts` for its
 * `site` block, which deliberately leaves the legal documents at the engine
 * defaults so these assertions cover the shipped prose). The unit half covers
 * token substitution, which fails startup rather than a request and so has no
 * request path to test through.
 */

import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { renderLegal } from "../src/site/legal/index.js";

const get = (path: string) => exports.default.fetch(`https://x${path}`);

const operator = { name: "Op & Co", jurisdiction: "Here", contactEmail: "a@b.c", effectiveDate: "Today" };

describe("landing page", () => {
  it("renders the game name, tagline and screenshots", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const html = await res.text();
    // `name` is unset in config, so it falls back to `appName`.
    expect(html).toContain("<h1>Eigen Test</h1>");
    expect(html).toContain("Race an opponent to the target.");
    expect(html).toContain('src="/screenshots/one.png"');
    expect(html).toContain('src="/screenshots/two.png"');
  });

  it("carries canonical, OG and Twitter tags built on the configured origin", async () => {
    const html = await (await get("/")).text();
    expect(html).toContain('<link rel="canonical" href="https://test.example.com/"/>');
    expect(html).toContain('<meta property="og:url" content="https://test.example.com/"/>');
    // Defaults to the name client_reference.md §22 already prescribes for the
    // Flutter app's own share card — one image, both surfaces.
    expect(html).toContain('<meta property="og:image" content="https://test.example.com/og-image.png"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
    expect(html).toContain('<meta charset="utf-8"/>');
  });

  it("describes itself as a game to crawlers, not as an organisation", async () => {
    const html = await (await get("/")).text();
    const jsonLd = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    expect(jsonLd).toBeDefined();
    const parsed = JSON.parse(jsonLd as string) as { "@type": string; applicationCategory: string; publisher: { name: string } };
    expect(parsed["@type"]).toBe("SoftwareApplication");
    expect(parsed.applicationCategory).toBe("GameApplication");
    expect(parsed.publisher.name).toBe("Eigen Test & Co");
  });

  it("takes its store buttons from the deep-link config, so store URLs are set once", async () => {
    const html = await (await get("/")).text();
    expect(html).toContain("https://apps.apple.com/app/id000000000");
    expect(html).toContain("https://play.google.com/store/apps/details?id=com.eigen.test");
  });
});

describe("legal documents", () => {
  it.each([
    ["/terms", "Terms of Service"],
    ["/privacy", "Privacy Policy"],
    ["/delete-account", "Delete Your Account"],
  ])("serves %s", async (path, heading) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain(`<h1>${heading}</h1>`);
  });

  it("renders the operator's details into every document", async () => {
    for (const path of ["/terms", "/privacy", "/delete-account"]) {
      const html = await (await get(path)).text();
      expect(html).toContain("legal@test.example.com");
      expect(html).toContain("1 January 2026");
    }
    // Jurisdiction appears in the governing-law and controller clauses.
    expect(await (await get("/terms")).text()).toContain("Testland");
    expect(await (await get("/privacy")).text()).toContain("Testland");
  });

  it("escapes operator values, so a name containing markup cannot break the page", async () => {
    const html = await (await get("/terms")).text();
    // The configured operator is "Eigen Test & Co" — JSX escapes it.
    expect(html).toContain("Eigen Test &amp; Co");
    expect(html).not.toContain("Eigen Test & Co");
  });

  it("names the real in-app deletion path, which app stores check", async () => {
    const html = await (await get("/delete-account")).text();
    expect(html).toContain("Settings");
    expect(html).toContain("Delete Account");
    // The email fallback is required for users who already uninstalled.
    expect(html).toContain("legal@test.example.com");
  });

  it("links the legal pages from every page footer", async () => {
    for (const path of ["/", "/terms", "/privacy"]) {
      const html = await (await get(path)).text();
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/delete-account"');
    }
  });
});

describe("crawler files", () => {
  it("lists the durable pages in the sitemap, absolute, and never share links", async () => {
    const res = await get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const xml = await res.text();
    for (const path of ["/", "/terms", "/privacy", "/delete-account"]) {
      expect(xml).toContain(`<loc>https://test.example.com${path === "/" ? "/" : path}</loc>`);
    }
    expect(xml).not.toContain("/join/");
  });

  it("points robots.txt at the sitemap and keeps crawlers out of the API and share links", async () => {
    const res = await get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const txt = await res.text();
    expect(txt).toContain("Sitemap: https://test.example.com/sitemap.xml");
    expect(txt).toContain("Disallow: /api/");
    expect(txt).toContain("Disallow: /join/");
    expect(txt).toContain("Disallow: /game/");
  });

  it("serves a manifest whose icon paths match what flutter_launcher_icons emits", async () => {
    const res = await get("/site.webmanifest");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/manifest+json");
    const manifest = (await res.json()) as { name: string; theme_color: string; icons: { src: string; purpose?: string }[] };
    expect(manifest.name).toBe("Eigen Test");
    expect(manifest.theme_color).toBe("#1a237e");
    // The Flutter app already generates these into web/icons/, so an
    // implementor copies that folder rather than authoring a second icon set.
    expect(manifest.icons.map((i) => i.src)).toEqual(["/icons/Icon-192.png", "/icons/Icon-512.png", "/icons/Icon-maskable-192.png", "/icons/Icon-maskable-512.png"]);
    expect(manifest.icons.filter((i) => i.purpose === "maskable")).toHaveLength(2);
  });
});

describe("renderLegal", () => {
  const props = { appName: "Test Game", operator };

  it("renders all three defaults as HTML fragments, not whole documents", () => {
    const legal = renderLegal(undefined, props);
    for (const fragment of Object.values(legal)) {
      expect(fragment).toContain("<h1>");
      // The shell owns the document; a fragment must not carry one.
      expect(fragment).not.toContain("<html");
      expect(fragment).not.toContain("<body");
    }
  });

  it("escapes operator values via JSX rather than a hand-rolled escaper", () => {
    const { terms } = renderLegal(undefined, props);
    expect(terms).toContain("Op &amp; Co");
    expect(terms).not.toContain("Op & Co");
  });

  it("interpolates the app name and operator details", () => {
    const { terms, privacy } = renderLegal(undefined, props);
    expect(terms).toContain("Test Game");
    expect(terms).toContain("Here");
    expect(privacy).toContain("a@b.c");
  });

  it("prefers an implementor's fragment over the default, per document", () => {
    const legal = renderLegal({ terms: "<h1>Mine</h1>" }, props);
    expect(legal.terms).toBe("<h1>Mine</h1>");
    // The others still fall back.
    expect(legal.privacy).toContain("Privacy Policy");
    expect(legal.deleteAccount).toContain("Delete Your Account");
  });

  it("leaves no unreplaced template placeholder anywhere in the defaults", () => {
    // The props refactor removed `{{token}}` substitution entirely; this guards
    // against prose being pasted back in from the old template format.
    for (const fragment of Object.values(renderLegal(undefined, props))) {
      expect(fragment).not.toMatch(/\{\{/);
    }
  });
});
