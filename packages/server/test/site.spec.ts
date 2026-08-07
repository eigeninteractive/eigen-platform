/**
 * The game's public web surface: the landing page, the three legal documents,
 * and the crawler files, all generated from `site` config.
 *
 * The integration half drives the real worker (see `test/worker.ts` for its
 * `site` block, which deliberately leaves the legal documents at the engine
 * defaults so these assertions cover the shipped prose). The unit half covers
 * token substitution, which fails startup rather than a request and so has no
 * request path to test through.
 *
 * KNOWN GAP: `site.css` is not covered by any of this. `tsup` inlines it as
 * text at build time via its `.css` loader, but under `vitest-pool-workers`
 * `import styles from "./site.css"` resolves to an empty module, so every page
 * here renders with an empty `<style>` — the palette, the inlined display face
 * and the layout are all absent from what these assertions see. A vite `load`
 * plugin, a `transform` plugin and a workerd `Text` module rule were all tried;
 * the pool resolves worker-side modules outside vite's plugin graph, so none of
 * them reach it. Anything asserted about the stylesheet has to be asserted
 * about the file's contents directly, not through a response.
 */

import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { renderLegal } from "../src/site/legal/index.js";

const get = (path: string) => exports.default.fetch(`https://x${path}`);

const operator = { name: "Op & Co", jurisdiction: "Here", contactEmail: "a@b.c", effectiveDate: "Today" };

describe("landing page", () => {
  it("renders the game name, tagline and screenshots", async () => {
    const res = await get("/download");
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

  it("carries canonical, OG and Twitter tags built on the inferred request origin", async () => {
    // The test worker omits `canonicalOrigin`, so absolute URLs are inferred
    // from the request — here `https://x`.
    const html = await (await get("/download")).text();
    expect(html).toContain('<link rel="canonical" href="https://x/download"/>');
    expect(html).toContain('<meta property="og:url" content="https://x/download"/>');
    // Defaults to the same name the branding guide prescribes for the Flutter
    // app's share card — one image, both surfaces.
    expect(html).toContain('<meta property="og:image" content="https://x/og-image.png"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
    expect(html).toContain('<meta charset="utf-8"/>');
  });

  it("describes itself as a game to crawlers, not as an organisation", async () => {
    const html = await (await get("/download")).text();
    const jsonLd = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
    expect(jsonLd).toBeDefined();
    const parsed = JSON.parse(jsonLd as string) as { "@type": string; applicationCategory: string; publisher: { name: string } };
    expect(parsed["@type"]).toBe("SoftwareApplication");
    expect(parsed.applicationCategory).toBe("GameApplication");
    expect(parsed.publisher.name).toBe("Eigen Test & Co");
  });

  it("takes its store buttons from the deep-link config, so store URLs are set once", async () => {
    const html = await (await get("/download")).text();
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
    for (const path of ["/download", "/terms", "/privacy"]) {
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
    for (const path of ["/download", "/terms", "/privacy", "/delete-account"]) {
      expect(xml).toContain(`<loc>https://x${path}</loc>`);
    }
    expect(xml).not.toContain("/join/");
  });

  it("points robots.txt at the sitemap and keeps crawlers out of the API and share links", async () => {
    const res = await get("/robots.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const txt = await res.text();
    expect(txt).toContain("Sitemap: https://x/sitemap.xml");
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

  it("lets a game's configured colour win over the brand default", async () => {
    const html = await (await get("/download")).text();

    // An inline style on the root element, which beats both the light and dark
    // `:root` blocks in the stylesheet, so a configured game keeps its colour
    // in either scheme.
    expect(html).toContain("--primary:#1a237e");
  });

  it("declares both brand faces and serves them itself", async () => {
    const html = await (await get("/download")).text();

    // Generated in TypeScript rather than written into site.css, so unlike the
    // rest of the stylesheet these rules are visible here — and generated from
    // the same table the routes below serve, so the two cannot drift.
    expect(html).toContain('font-family:"Inter"');
    expect(html).toContain('font-family:"Space Grotesk"');
    expect(html).toContain("font-display:swap");

    // No third party on an operator's domain, and nothing to consent to.
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");

    for (const path of ["/_eigen/font/v1/inter.woff2", "/_eigen/font/v1/space-grotesk.woff2"]) {
      expect(html).toContain(`url(${path})`);

      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("font/woff2");
      // Immutable is only honest because the path carries a version segment
      // that changes when the bytes do.
      expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");

      // Real woff2, not a base64 string that survived as text: the format's
      // magic number is `wOF2`.
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("wOF2");
      expect(bytes.byteLength).toBeGreaterThan(10_000);
    }
  });
});

describe("web root", () => {
  it("falls back to the download page when no Flutter asset matches first", async () => {
    const res = await exports.default.fetch(new Request("https://x/", { redirect: "manual" }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/download");
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
