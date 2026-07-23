/**
 * The game's public web surface — everything a deployed game serves on its own
 * host besides the API. Unauthed, outside `/api`, and absent from the OpenAPI
 * document, exactly like the deep-link routes in `links.tsx`:
 *
 *   - `GET /` — the landing page, rendered from `site` config.
 *   - `GET /terms`, `/privacy`, `/delete-account` — the legal documents.
 *   - `GET /sitemap.xml`, `GET /robots.txt` — crawler directives.
 *   - `GET /site.webmanifest` — the web app manifest.
 *
 * Every one of these is overridable with zero configuration: Cloudflare serves
 * a matching static asset *before* invoking the worker, and default
 * `html_handling` resolves the extensionless `/terms` to `public/terms.html`.
 * So an implementor who wants a different page just ships the file.
 *
 * These routes need no `run_worker_first` entry: a request matching no static
 * file already falls through to the worker. The one rule is not to add a
 * `public/` file that shadows a path you did not mean to replace.
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
    url: `${origin}/`,
    image: ogImage,
    ...(os.length > 0 ? { operatingSystem: os.join(", ") } : {}),
    publisher: { "@type": "Organization", name: site.operator.name },
  });
}

const LEGAL_TITLES = { "/terms": "Terms of Service", "/privacy": "Privacy Policy", "/delete-account": "Delete Account" } as const;

export function registerSiteRoutes(app: EngineApp, ctx: RouteContext): void {
  const site = ctx.site as ResolvedSite;
  const stores = storeLinks(ctx.deepLink);
  // Absolute URLs (canonical, OG, sitemap) are built from the request origin.
  // Correct for a worker on a single host; disable the workers.dev route in
  // production so that host is the canonical one.
  const originOf = (url: string): string => new URL(url).origin;

  app.get("/", (c) => {
    const origin = originOf(c.req.url);
    const ogImage = `${origin}${site.ogImage}`;
    return c.html(
      renderDocument(
        <Page title={`${site.name} — ${site.tagline}`} description={site.tagline} siteName={site.name} primaryColor={site.primaryColor} canonicalUrl={`${origin}/`} ogImage={ogImage} operatorName={site.operator.name} jsonLd={jsonLdFor(site, ctx.deepLink, origin, ogImage)}>
          <h1>{site.name}</h1>
          <p class="lead">{site.tagline}</p>
          {site.description !== site.tagline && <p>{site.description}</p>}
          {site.screenshots.length > 0 && <Screenshots site={site} />}
          {stores.length > 0 && <StoreButtons links={stores} />}
        </Page>,
      ),
      200,
      { "Cache-Control": PAGE_CACHE },
    );
  });

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
  const urls = ["/", "/terms", "/privacy", "/delete-account"];
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

  // Icon paths match what `flutter_launcher_icons` emits into a Flutter app's
  // `web/` directory, so an implementor copies that folder into `public/`
  // rather than authoring a second icon set. The engine generates no images.
  const manifest = JSON.stringify({
    name: site.name,
    short_name: site.name,
    description: site.tagline,
    start_url: "/",
    display: "browser",
    theme_color: site.primaryColor,
    background_color: site.primaryColor,
    icons: [
      { src: ICONS.icon192, sizes: "192x192", type: "image/png" },
      { src: ICONS.icon512, sizes: "512x512", type: "image/png" },
      { src: ICONS.maskable192, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: ICONS.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  });
  app.get("/site.webmanifest", (c) => c.body(manifest, 200, { "Content-Type": "application/manifest+json", "Cache-Control": CRAWLER_CACHE }));
}
