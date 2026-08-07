/**
 * The game's public web surface — everything a deployed game serves on its own
 * host besides the API. Unauthed, outside `/api`, and absent from the OpenAPI
 * document, exactly like the deep-link routes in `links.tsx`:
 *
 *   - `GET /download` — the native app download page, rendered from `site`.
 *   - `GET /terms`, `/privacy`, `/delete-account` — the legal documents.
 *   - `GET /sitemap.xml`, `GET /robots.txt` — crawler directives.
 *   - `GET /site.webmanifest` — the web app manifest.
 *
 * The scaffold lists these in Static Assets' `run_worker_first`, keeping
 * Flutter's SPA fallback from swallowing legal, download, and crawler routes.
 * Implementors customize legal prose through the typed `site.legal` config.
 *
 * **Path note.** These live on the game's own host alongside the app's deep
 * links (`/join/:code`, `/game/:id`), so the app's Android App Links
 * intent-filter must be scoped with `android:pathPrefix="/join"` and
 * `android:pathPrefix="/game"` — otherwise Android claims *every* path on the
 * host and a tap on "Terms of Service" bounces back into the app, which has no
 * such route. iOS is already scoped by the AASA `paths` entry.
 */

import type { DeepLinkConfig, EngineApp, RouteContext } from "../engine.js";
import type { ResolvedSite } from "../site/config.js";
import { FONTS, fontBytes } from "../site/fonts.js";
import { ICONS, Page, RawHtml, renderDocument } from "../site/page.js";

/** Cached for a day: crawler files change only on redeploy. */
const CRAWLER_CACHE = "public, max-age=86400";
/** Cached for an hour: prose and store links change rarely, but an operator
 * fixing a typo in their legal text should not wait a day to see it live. */
const PAGE_CACHE = "public, max-age=3600";

/** Store buttons, taken from the deep-link config so store URLs are configured
 * exactly once. */
function storeLinks(deepLink: DeepLinkConfig | null): { label: string; url: string }[] {
  if (deepLink === null) return [];
  const links: { label: string; url: string }[] = [];
  if (deepLink.apple?.storeUrl !== undefined) links.push({ label: "Download on the App Store", url: deepLink.apple.storeUrl });
  if (deepLink.android?.storeUrl !== undefined) links.push({ label: "Get it on Google Play", url: deepLink.android.storeUrl });
  return links;
}

function StoreButtons({ links }: { links: { label: string; url: string }[] }) {
  return (
    <div>
      {links.map((l) => (
        <a class="btn" href={l.url}>
          {l.label}
        </a>
      ))}
    </div>
  );
}

function Screenshots({ site }: { site: ResolvedSite }) {
  return (
    <div class="shots">
      {site.screenshots.map((file, i) => (
        <img src={`/screenshots/${file}`} alt={`${site.name} screenshot ${i + 1}`} loading="lazy" />
      ))}
    </div>
  );
}

/** `SoftwareApplication`/`GameApplication` rather than `Organization` — this
 * page is a game, and that is what a search engine should understand it to be. */
function jsonLdFor(site: ResolvedSite, deepLink: DeepLinkConfig | null, origin: string, ogImage: string): string {
  const os = [deepLink?.android !== undefined ? "Android" : null, deepLink?.apple !== undefined ? "iOS" : null].filter((v) => v !== null);
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    applicationCategory: "GameApplication",
    name: site.name,
    description: site.tagline,
    url: `${origin}/download`,
    image: ogImage,
    ...(os.length > 0 ? { operatingSystem: os.join(", ") } : {}),
    publisher: { "@type": "Organization", name: site.operator.name },
  });
}

const LEGAL_TITLES = { "/terms": "Terms of Service", "/privacy": "Privacy Policy", "/delete-account": "Delete Account" } as const;

export function registerSiteRoutes(app: EngineApp, ctx: RouteContext): void {
  const site = ctx.site as ResolvedSite;
  // Absolute URLs (canonical, OG, sitemap) are built from the request origin.
  // Correct for a worker on a single host; disable the workers.dev route in
  // production so that host is the canonical one.
  const originOf = (url: string): string => new URL(url).origin;

  for (const [path, fragment] of [
    ["/terms", site.legal.terms],
    ["/privacy", site.legal.privacy],
    ["/delete-account", site.legal.deleteAccount],
  ] as const) {
    const title = LEGAL_TITLES[path];
    app.get(path, (c) =>
      c.html(
        renderDocument(
          <Page title={`${title} — ${site.name}`} description={`${title} for ${site.name}.`} siteName={site.name} primaryColor={site.primaryColor} canonicalUrl={`${originOf(c.req.url)}${path}`} operatorName={site.operator.name}>
            <RawHtml html={fragment} />
          </Page>,
        ),
        200,
        { "Cache-Control": PAGE_CACHE },
      ),
    );
  }

  // Only the durable, indexable pages. Share links are ephemeral, already carry
  // `noindex`, and would churn the sitemap on every game created.
  const urls = ["/download", "/terms", "/privacy", "/delete-account"];
  app.get("/sitemap.xml", (c) => {
    const origin = originOf(c.req.url);
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${origin}${u}</loc><changefreq>monthly</changefreq></url>`).join("\n")}\n</urlset>`;
    return c.body(sitemap, 200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": CRAWLER_CACHE });
  });

  // `/api/` is disallowed because it is authenticated and useless to a crawler,
  // not because it is secret. `/join/` and `/game/` are per-game app-link paths,
  // transient and not content.
  app.get("/robots.txt", (c) => {
    const robots = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /join/\nDisallow: /game/\n\nSitemap: ${originOf(c.req.url)}/sitemap.xml\n`;
    return c.body(robots, 200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": CRAWLER_CACHE });
  });
}

/** Register the web/native handoff independently of legal-site configuration.
 *
 * A fresh scaffold can serve `/download` before the implementor has supplied
 * legally meaningful operator details. Adding `site` later enriches the same
 * route with branding, screenshots, structured data, and the legal footer.
 */
export function registerDownloadRoute(app: EngineApp, ctx: RouteContext): void {
  const stores = storeLinks(ctx.deepLink);
  const enabled = (env: unknown): boolean => ctx.site !== null || ctx.deepLink !== null || ctx.webAssets(env) !== null;
  const name = ctx.site?.name ?? ctx.appName;
  const tagline = ctx.site?.tagline ?? `Play ${name} in your browser or get the native app.`;

  // Icon paths match Flutter's web build. Keep the engine manifest available
  // even before legal-site configuration, because Page links it from the
  // out-of-box download page.
  // The EigenInteractive primary, matching site.css and the Flutter shell's
  // default seed. It reaches the manifest and so the browser's install UI, and
  // a game that has not configured `site` yet should still look like something
  // rather than like Material's baseline purple.
  const color = ctx.site?.primaryColor ?? "#006a60";
  const manifest = JSON.stringify({
    name,
    short_name: name,
    description: tagline,
    start_url: "/",
    display: "browser",
    theme_color: color,
    background_color: color,
    icons: [
      { src: ICONS.icon192, sizes: "192x192", type: "image/png" },
      { src: ICONS.icon512, sizes: "512x512", type: "image/png" },
      { src: ICONS.maskable192, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: ICONS.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });

  // The brand faces, ungated: every page the engine renders references them,
  // including the legal documents and the `/j` share page, and a worker running
  // `deepLink` without `site` still serves `/download`. Cached hard because the
  // path carries a version segment that changes when the bytes do.
  for (const font of FONTS) {
    app.get(
      font.url,
      () =>
        new Response(fontBytes(font.base64) as unknown as BodyInit, {
          headers: {
            "Content-Type": "font/woff2",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        }),
    );
  }

  // Static Assets serves Flutter's index at `/` before the Worker runs. This
  // redirect is the graceful fallback when there is no matching web asset.
  app.get("/", (c) => (enabled(c.env) ? c.redirect("/download", 302) : c.notFound()));

  app.get("/download", (c) => {
    if (!enabled(c.env)) return c.notFound();

    const origin = new URL(c.req.url).origin;
    const site = ctx.site;
    const ogImage = site === null ? undefined : `${origin}${site.ogImage}`;
    return c.html(
      renderDocument(
        <Page title={`${name} — ${tagline}`} description={tagline} siteName={name} primaryColor={site?.primaryColor} canonicalUrl={`${origin}/download`} ogImage={ogImage} operatorName={site?.operator.name} jsonLd={site === null || ogImage === undefined ? undefined : jsonLdFor(site, ctx.deepLink, origin, ogImage)}>
          <h1>{name}</h1>
          <p class="lead">{tagline}</p>
          {site !== null && site.description !== site.tagline && <p>{site.description}</p>}
          {site !== null && site.screenshots.length > 0 && <Screenshots site={site} />}
          <div>
            <a class="btn" href="/">
              Play on the web
            </a>
            {stores.length > 0 && <StoreButtons links={stores} />}
          </div>
        </Page>,
      ),
      200,
      { "Cache-Control": PAGE_CACHE },
    );
  });

  app.get("/site.webmanifest", (c) => (enabled(c.env) ? c.body(manifest, 200, { "Content-Type": "application/manifest+json", "Cache-Control": CRAWLER_CACHE }) : c.notFound()));
}
