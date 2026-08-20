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
 * KNOWN GAP: `site.css.txt` is not covered by any of this. `tsdown` inlines it as
 * text at build time via its `.txt` loader, but under `vitest-pool-workers`
 * `import styles from "./site.css.txt"` resolves to an empty module, so every page
 * here renders with an empty `<style>`, so the palette, the inlined display face
 * and the layout are all absent from what these assertions see. A vite `load`
 * plugin, a `transform` plugin and a workerd `Text` module rule were all tried;
 * the pool resolves worker-side modules outside vite's plugin graph, so none of
 * them reach it. Anything asserted about the stylesheet has to be asserted
 * about the file's contents directly, not through a response.
 */

import { createExecutionContext } from "cloudflare:test";
import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { createEngine } from "../src/engine.js";
import { CREDIT_URL } from "../src/site/config.js";
import { ENGINE_ICON_URL } from "../src/site/icon.js";
import { renderLegal } from "../src/site/legal/index.js";
import { ICONS, onPrimary } from "../src/site/page.js";

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
    // from the request, here `https://x`.
    const html = await (await get("/download")).text();
    expect(html).toContain('<link rel="canonical" href="https://x/download"/>');
    expect(html).toContain('<meta property="og:url" content="https://x/download"/>');
    // Defaults to the same name the branding guide prescribes for the Flutter
    // app's share card: one image, both surfaces.
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

  it("leads with the first available action and outlines the rest", async () => {
    const html = await (await get("/download")).text();
    // The test worker binds no ASSETS, so there is no web build and the first
    // store link is the call to action.
    expect(html).toContain('<a class="btn" href="https://apps.apple.com/app/id000000000"');
    expect(html).toContain('<a class="btn ghost" href="https://play.google.com/store/apps/details?id=com.eigen.test"');
  });

  it("offers neither the web button nor the app icon without a deployed web build", async () => {
    // Both would be broken promises: `/` has no asset to serve and would bounce
    // straight back here, and there is no icon file to point at.
    const html = await (await get("/download")).text();
    expect(html).not.toContain("Play on the web");
    expect(html).not.toContain(`<img class="logo" src="${ICONS.icon192}"`);
  });

  it("links no icon it cannot serve", async () => {
    // The whole point of the placeholder. `favicon.png` and the apple-touch
    // icon live in `public/`, which is empty here, so linking them would leave
    // the tab blank; the engine's own mark is always serveable.
    const html = await (await get("/download")).text();
    expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="${ENGINE_ICON_URL}"/>`);
    expect(html).not.toContain(`href="${ICONS.favicon}"`);
    // Apple's touch icon has no SVG support, so this game gets none at all
    // rather than one pointing at a missing file.
    expect(html).not.toContain("apple-touch-icon");
  });

  it("stands the engine's mark in for the icon it does not have yet", async () => {
    const html = await (await get("/download")).text();
    expect(html).toContain('<svg class="logo"');
    // Drawn in the page's own tokens rather than in fixed hexes, so it takes
    // the game's configured colour and follows the visitor's colour scheme.
    expect(html).toContain('stroke="var(--primary)"');
    // Attribute names reach the document verbatim: hono/jsx does not carry
    // React's camelCase mapping, so `strokeWidth` would render as-is and be
    // ignored by every renderer.
    expect(html).toContain("stroke-width=");
    expect(html).not.toContain("strokeWidth");
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
    // The configured operator is "Eigen Test & Co", and JSX escapes it.
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

  it("links the legal pages from every page footer, the download page included", async () => {
    for (const path of ["/download", "/terms", "/privacy"]) {
      const html = await (await get(path)).text();
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/delete-account"');
    }
  });

  it("credits the engine in the same footer, on every page, with only the name linked", async () => {
    for (const path of ["/download", "/terms", "/privacy", "/delete-account"]) {
      const html = await (await get(path)).text();
      // The sentence stays prose; the brand inside it is the anchor. A single
      // anchor wrapping the whole line would make "Build with" clickable too.
      expect(html).toContain(`<span class="credit">Built with <a href="${CREDIT_URL}" target="_blank" rel="noopener">EigenInteractive</a></span>`);
    }
  });

  it("opens every outbound and legal link in its own tab", async () => {
    const html = await (await get("/download")).text();
    for (const href of ["/terms", "/privacy", "/delete-account", "https://apps.apple.com/app/id000000000", "https://play.google.com/store/apps/details?id=com.eigen.test"]) {
      expect(html).toContain(`href="${href}" target="_blank" rel="noopener"`);
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

  it("serves a manifest advertising only icons that exist", async () => {
    const res = await get("/site.webmanifest");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/manifest+json");
    // An hour, not a day: the icon list below depends on what is in `public/`,
    // so the deploy that adds icons must not be shadowed by a stale copy.
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    const manifest = (await res.json()) as { name: string; theme_color: string; icons: { src: string; purpose?: string }[] };
    expect(manifest.name).toBe("Eigen Test");
    expect(manifest.theme_color).toBe("#1a237e");
    // This worker binds no ASSETS, so the game has no icons and the manifest
    // says so rather than listing four PNGs that would 404. The PNG set is
    // asserted below, against a worker that has them.
    expect(manifest.icons).toEqual([{ src: ENGINE_ICON_URL, sizes: "any", type: "image/svg+xml" }]);
  });

  it("serves the placeholder mark in the game's own colour", async () => {
    const res = await get(ENGINE_ICON_URL);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/svg+xml");
    const svg = await res.text();
    expect(svg).toContain("#1a237e");
    // The neutral stroke is the one that disappears against a dark tab strip,
    // so it is the one that switches; the accent is a single configured value
    // with no partner to switch to.
    expect(svg).toContain("prefers-color-scheme:dark");
  });

  it("lets a game's configured colour win over the brand default", async () => {
    const html = await (await get("/download")).text();

    // An inline style on the root element, which beats both the light and dark
    // `:root` blocks in the stylesheet, so a configured game keeps its colour
    // in either scheme.
    expect(html).toContain("--primary:#1a237e");
    // And the ink to put on it moves with it. Overriding `--primary` alone
    // would leave whichever `--on-primary` the visitor's scheme happened to
    // set: for a colour this dark, the dark scheme's near-black.
    expect(html).toContain("--on-primary:#ffffff");
  });

  it("declares both brand faces and serves them itself", async () => {
    const html = await (await get("/download")).text();

    // Generated in TypeScript rather than written into site.css.txt, so unlike the
    // rest of the stylesheet these rules are visible here, and generated from
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

      // Again, because the response is cloned into `caches.default` and the
      // original returned. Getting that pair the wrong way round serves an
      // already-consumed body, which is empty rather than an error.
      const repeat = new Uint8Array(await (await get(path)).arrayBuffer());
      expect(repeat.byteLength).toBe(bytes.byteLength);
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

describe("before anything is published", () => {
  // The scaffold's own state on its first `wrangler dev`: `site` unconfigured,
  // no `deepLink`, and ASSETS bound to an empty `public/`: bound, so the page
  // mounts, but answering 404 for everything, so there is nothing to link to.
  // The suite's main worker cannot show this: it has both a site and store URLs.
  const scaffold = createEngine({
    gameModule: { versions: {} },
    appName: "Sustained",
    d1: () => {
      throw new Error("/download reads no D1");
    },
    gameDO: () => {
      throw new Error("/download reaches no Durable Object");
    },
  });
  const empty = { ASSETS: { fetch: () => Promise.resolve(new Response(null, { status: 404 })) } };
  // `ExportedHandler` declares every handler optional; `createEngine` always
  // returns this one. Narrowed once here rather than asserted at each call.
  const handle = scaffold.fetch;
  if (handle === undefined) throw new Error("createEngine returned no fetch handler");

  const download = async (): Promise<string> => {
    const res = await handle(new Request("https://x/download"), empty as never, createExecutionContext());
    expect(res.status).toBe(200);
    return await res.text();
  };

  it("says so, rather than trailing off after the tagline with nothing to click", async () => {
    const html = await download();
    expect(html).toContain("Coming soon.");
    expect(html).not.toContain("Play on the web");
    expect(html).not.toContain('class="actions"');
  });

  it("still has a mark, a name and a footer", async () => {
    const html = await download();
    expect(html).toContain('<svg class="logo"');
    expect(html).toContain("<h1>Sustained</h1>");
    expect(html).toContain("Built with ");
    expect(html).toContain(">EigenInteractive</a>");
    // No `site`, so the legal routes are not mounted and must not be linked.
    expect(html).not.toContain('href="/terms"');
  });
});

describe("once the game ships icons of its own", () => {
  // Closes the branch the download-page tests above cannot reach: the suite's
  // main worker binds no ASSETS at all, so it can only ever show the
  // placeholder. Here the binding answers like a `public/` that has icons in
  // it, which is what proves the engine steps out of the way.
  const withAssets = (files: Record<string, { body: string; type: string }>) => {
    const engine = createEngine({
      gameModule: { versions: {} },
      appName: "Sustained",
      d1: () => {
        throw new Error("/download reads no D1");
      },
      gameDO: () => {
        throw new Error("/download reaches no Durable Object");
      },
    });
    const handle = engine.fetch;
    if (handle === undefined) throw new Error("createEngine returned no fetch handler");
    const assets = {
      ASSETS: {
        fetch: (request: Request) => {
          const file = files[new URL(request.url).pathname];
          return Promise.resolve(file === undefined ? new Response(null, { status: 404 }) : new Response(file.body, { headers: { "Content-Type": file.type } }));
        },
      },
    };
    return (path: string) => handle(new Request(`https://x${path}`), assets as never, createExecutionContext());
  };

  const png = { body: "PNG", type: "image/png" };

  it("links the game's own icons and drops the placeholder", async () => {
    const html = await (await withAssets({ [ICONS.favicon]: png })("/download")).text();
    expect(html).toContain(`<link rel="icon" href="${ICONS.favicon}"/>`);
    expect(html).toContain(`<link rel="apple-touch-icon" href="${ICONS.appleTouch}"/>`);
    expect(html).not.toContain(ENGINE_ICON_URL);
    // And the hero stops standing in the engine's mark.
    expect(html).toContain(`<img class="logo" src="${ICONS.icon192}"`);
    expect(html).not.toContain('<svg class="logo"');
  });

  it("advertises the PNG set in the manifest", async () => {
    const res = await withAssets({ [ICONS.favicon]: png })("/site.webmanifest");
    const manifest = (await res.json()) as { icons: { src: string; purpose?: string }[] };
    // The Flutter app already generates these into web/icons/, so an
    // implementor copies that folder rather than authoring a second icon set.
    expect(manifest.icons.map((i) => i.src)).toEqual([ICONS.icon192, ICONS.icon512, ICONS.maskable192, ICONS.maskable512]);
    expect(manifest.icons.filter((i) => i.purpose === "maskable")).toHaveLength(2);
  });

  it("does not need a web build, only icons", async () => {
    // The case that motivated splitting the probe: an Android-only game has no
    // `index.html` and never will, and its launcher icons are still its own.
    const html = await (await withAssets({ [ICONS.favicon]: png })("/download")).text();
    expect(html).toContain(`<link rel="icon" href="${ICONS.favicon}"/>`);
    expect(html).not.toContain("Play on the web");
  });

  it("is not fooled by the SPA fallback answering for a missing icon", async () => {
    // `not_found_handling` is `single-page-application` in the scaffold, so
    // once `index.html` exists a request for an absent asset returns that
    // document with `200 OK`. Status alone would read as an icon and link a
    // web page where an image belongs; the content type is what settles it.
    const spa = { body: "<!doctype html>", type: "text/html" };
    const html = await (await withAssets({ "/index.html": spa, [ICONS.favicon]: spa })("/download")).text();
    expect(html).toContain(`<link rel="icon" type="image/svg+xml" href="${ENGINE_ICON_URL}"/>`);
    expect(html).not.toContain(`<link rel="icon" href="${ICONS.favicon}"/>`);
    // The web build is real, though, so that half is still offered.
    expect(html).toContain("Play on the web");
  });
});

describe("onPrimary", () => {
  it("picks the ink that stays readable on the configured colour", () => {
    // Both ends of the engine's own palette: the light scheme's primary is dark
    // enough for white, the dark scheme's is not, which is the pairing that
    // failed before this existed.
    expect(onPrimary("#006a60")).toBe("#ffffff");
    expect(onPrimary("#82d5c8")).toBe("#0d1211");
    // Luminance, not lightness: a saturated yellow is far brighter than a
    // saturated blue at the same nominal tone.
    expect(onPrimary("#ffd600")).toBe("#0d1211");
    expect(onPrimary("#1a237e")).toBe("#ffffff");
  });

  it("accepts shorthand hex and falls back to white on anything it cannot read", () => {
    expect(onPrimary("#fff")).toBe("#0d1211");
    expect(onPrimary("#000")).toBe("#ffffff");
    // Unparseable, so the comparison against NaN fails, which lands on white,
    // the behaviour every page had before the pairing was computed at all.
    expect(onPrimary("rebeccapurple")).toBe("#ffffff");
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
