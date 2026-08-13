/**
 * The game's public web surface: everything a deployed game serves on its own
 * host besides the API. Unauthed, outside `/api`, and absent from the OpenAPI
 * document, exactly like the deep-link routes in `links.tsx`:
 *
 *   - `GET /download`: the native app download page, rendered from `site`.
 *   - `GET /terms`, `/privacy`, `/delete-account`: the legal documents.
 *   - `GET /sitemap.xml`, `GET /robots.txt`: crawler directives.
 *   - `GET /site.webmanifest`: the web app manifest.
 *
 * The scaffold lists these in Static Assets' `run_worker_first`, keeping
 * Flutter's SPA fallback from swallowing legal, download, and crawler routes.
 * Implementors customize legal prose through the typed `site.legal` config.
 *
 * **Path note.** These live on the game's own host alongside the app's deep
 * links (`/join/:code`, `/game/:id`), so the app's Android App Links
 * intent-filter must be scoped with `android:pathPrefix="/join"` and
 * `android:pathPrefix="/game"`, or else Android claims *every* path on the
 * host and a tap on "Terms of Service" bounces back into the app, which has no
 * such route. iOS is already scoped by the AASA `paths` entry.
 */

import type { DeepLinkConfig, EngineApp, RouteContext } from "../engine.js";
import type { ResolvedSite } from "../site/config.js";
import { FONTS, fontBytes } from "../site/fonts.js";
import { DEFAULT_PRIMARY, ENGINE_ICON_URL, engineIconSvg } from "../site/icon.js";
import { ICONS, NEW_TAB, Page, RawHtml, renderDocument } from "../site/page.js";

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

/** The first action is the page's call to action and takes the filled button;
 * the rest are outlined. Which one comes first depends on what the game has:
 * a game with no web build leads with its store link. */
function Actions({ links }: { links: { label: string; url: string }[] }) {
  return (
    <div class="actions">
      {links.map((l, i) => (
        <a class={i === 0 ? "btn" : "btn ghost"} href={l.url} {...NEW_TAB}>
          {l.label}
        </a>
      ))}
    </div>
  );
}

/** The EigenInteractive mark, shown when the game has no icon of its own to
 * show yet, which is every game until a Flutter web build reaches `public/`.
 *
 * Inline rather than a served file: it is two paths, so a request for it would
 * cost more than the bytes it saves, and inline is what lets it be *drawn* in
 * the page's own tokens. So it takes a configured `site.primaryColor` and
 * follows the visitor's colour scheme without a second copy existing anywhere.
 *
 * Same reasoning as the shell's default seed and credit line: a game looks like
 * an EigenInteractive game until its author says otherwise, and saying
 * otherwise here means shipping an icon. Attribute names are passed through
 * verbatim by hono/jsx, so these are the SVG spellings, not React's. */
function EigenMark() {
  return (
    <svg class="logo" viewBox="25.3 19 149 149" width="96" height="96" fill="none" aria-hidden="true">
      <path d="M80 109L150.711 33.289" stroke="var(--primary)" stroke-width="26" stroke-linecap="butt" />
      <path d="M80 160V104L48.887 72.887" stroke="var(--fg)" stroke-width="26" stroke-linejoin="miter" stroke-linecap="butt" />
    </svg>
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

/** `SoftwareApplication`/`GameApplication` rather than `Organization`, because this
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

/** Fetches an asset through the `ASSETS` binding and discards its body, so a
 * caller can ask whether something is there without paying for it.
 *
 * Null when the deployment has no binding at all, which is a native-only game.
 * The body is cancelled rather than left dangling; nothing here reads one. */
async function probeAsset(assets: Fetcher | null, url: string): Promise<Response | null> {
  if (assets === null) return null;
  const res = await assets.fetch(new Request(url));
  await res.body?.cancel();
  return res;
}

/**
 * Whether a Flutter web build is actually deployed, which is what the "Play on
 * the web" button depends on.
 *
 * The ASSETS binding alone cannot answer this: the scaffold binds it whether or
 * not `public/` has anything in it, so it is bound from the first
 * `wrangler dev`. Offering "Play on the web" on that evidence sends the visitor
 * to `/`, which has no asset to serve and so redirects back here. Asking the
 * binding for the SPA entry point answers it properly: with no `index.html`
 * there is nothing for the fallback to serve, so it 404s.
 */
async function hasWebBuild(assets: Fetcher | null, origin: string): Promise<boolean> {
  const res = await probeAsset(assets, `${origin}/index.html`);
  return res?.ok === true;
}

/**
 * Whether this game has app icons of its own, which is what the document
 * shell's `<link rel="icon">`, the manifest, and the download page's logo
 * depend on.
 *
 * A separate question from {@link hasWebBuild}, and it used to be folded into
 * it on the grounds that `flutter build web` emits `favicon.png` and `icons/`
 * beside `index.html`: one bundle, so one probe. That holds for a game that
 * ships on the web and fails the case worth supporting, an Android-only game
 * that has icons but will never have an `index.html`. Such a game dropping its
 * launcher icons into `public/` should get them, and under one probe it never
 * would. So: two questions, two probes.
 *
 * The content type is checked, not just the status. `not_found_handling` is
 * `single-page-application` in the scaffold, so once `index.html` exists a
 * request for a missing asset is answered *with that document*, `200 OK`. A
 * game whose web build has no `favicon.png` would otherwise read as having one
 * and link a page where an image belongs.
 */
async function hasAppIcons(assets: Fetcher | null, origin: string): Promise<boolean> {
  const res = await probeAsset(assets, `${origin}${ICONS.favicon}`);
  if (res?.ok !== true) return false;
  return (res.headers.get("content-type") ?? "").startsWith("image/");
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
    app.get(path, async (c) =>
      c.html(
        renderDocument(
          <Page
            title={`${title}: ${site.name}`}
            description={`${title} for ${site.name}.`}
            siteName={site.name}
            primaryColor={site.primaryColor}
            canonicalUrl={`${originOf(c.req.url)}${path}`}
            operatorName={site.operator.name}
            madeByCredit={site.madeByCredit}
            appIcons={await hasAppIcons(ctx.webAssets(c.env), originOf(c.req.url))}
          >
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

  // Keep the engine manifest available even before legal-site configuration,
  // because Page links it from the out-of-box download page.
  //
  // The EigenInteractive primary, matching site.css and the Flutter shell's
  // default seed. It reaches the manifest and so the browser's install UI, and
  // a game that has not configured `site` yet should still look like something
  // rather than like Material's baseline purple.
  const color = ctx.site?.primaryColor ?? DEFAULT_PRIMARY;

  // Two icon sets, chosen per request by what the game actually has.
  //
  // The PNG set is the one an install prompt wants, and its paths match
  // Flutter's web build. The placeholder is a single scalable file, declared
  // `sizes: "any"` because that is what the manifest spec says an SVG entry
  // means, and a browser will accept it for display. It will not usually earn
  // an install prompt, which is the right outcome: a game with no icons of its
  // own has no web build to install either.
  const appIconSet = [
    { src: ICONS.icon192, sizes: "192x192", type: "image/png" },
    { src: ICONS.icon512, sizes: "512x512", type: "image/png" },
    { src: ICONS.maskable192, sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: ICONS.maskable512, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];
  const placeholderIconSet = [{ src: ENGINE_ICON_URL, sizes: "any", type: "image/svg+xml" }];
  const manifestFor = (appIcons: boolean): string =>
    JSON.stringify({
      name,
      short_name: name,
      description: tagline,
      start_url: "/",
      display: "browser",
      theme_color: color,
      background_color: color,
      icons: appIcons ? appIconSet : placeholderIconSet,
    });

  // The placeholder mark, ungated for the same reason the faces below are:
  // every page the engine renders links it until the game has icons of its own,
  // including a worker running `deepLink` without `site`.
  //
  // Not `immutable` and not fronted by `caches.default`, unlike the fonts. The
  // bytes carry `site.primaryColor`, so they change when an implementor changes
  // that and redeploys, which a year-long immutable cache would hide from every
  // returning visitor. An hour matches the pages that link it, and the file is
  // a few hundred bytes built from a string.
  const iconSvg = engineIconSvg(color);
  app.get(ENGINE_ICON_URL, (c) => c.body(iconSvg, 200, { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": PAGE_CACHE }));

  // The brand faces, ungated: every page the engine renders references them,
  // including the legal documents and the `/j` share page, and a worker running
  // `deepLink` without `site` still serves `/download`.
  //
  // Fronted by `caches.default` for the same reason the avatar route is: a
  // Worker response is not edge-cached automatically, so the immutable header
  // below only reaches the device. Without this, every first-time visitor to
  // every game would decode both faces from base64 again. The URL is the cache
  // key and carries a version segment, so replacing a font is a natural miss
  // rather than something to invalidate.
  for (const font of FONTS) {
    app.get(font.url, async (c) => {
      const cache = caches.default;
      const cacheKey = new Request(c.req.url);
      const hit = await cache.match(cacheKey);
      if (hit !== undefined) return hit;

      const response = new Response(fontBytes(font.base64) as unknown as BodyInit, {
        headers: {
          "Content-Type": "font/woff2",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    });
  }

  // Static Assets serves Flutter's index at `/` before the Worker runs. This
  // redirect is the graceful fallback when there is no matching web asset.
  app.get("/", (c) => (enabled(c.env) ? c.redirect("/download", 302) : c.notFound()));

  app.get("/download", async (c) => {
    if (!enabled(c.env)) return c.notFound();

    const origin = new URL(c.req.url).origin;
    const site = ctx.site;
    const assets = ctx.webAssets(c.env);
    const ogImage = site === null ? undefined : `${origin}${site.ogImage}`;
    const [web, appIcons] = await Promise.all([hasWebBuild(assets, origin), hasAppIcons(assets, origin)]);
    const actions = [...(web ? [{ label: "Play on the web", url: "/" }] : []), ...stores];
    return c.html(
      renderDocument(
        <Page
          title={`${name}: ${tagline}`}
          description={tagline}
          siteName={name}
          primaryColor={site?.primaryColor}
          canonicalUrl={`${origin}/download`}
          ogImage={ogImage}
          operatorName={site?.operator.name}
          madeByCredit={site?.madeByCredit}
          jsonLd={site === null || ogImage === undefined ? undefined : jsonLdFor(site, ctx.deepLink, origin, ogImage)}
          appIcons={appIcons}
        >
          <main class="hero">
            {/* The app's own launcher icon, at twice its rendered size, falling
                back to the engine's mark until the game ships one. Decorative
                either way: the name it stands for is the <h1> directly below
                it. Keyed to the icons rather than to the web build, so an
                Android-only game that drops its launcher icons into `public/`
                gets its own mark here. */}
            {appIcons ? <img class="logo" src={ICONS.icon192} alt="" width="96" height="96" /> : <EigenMark />}
            <h1>{name}</h1>
            <p class="lead">{tagline}</p>
            {site !== null && site.description !== site.tagline && <p>{site.description}</p>}
            {/* Nothing to click means nothing is published: no web build in
                `public/`, and no store URLs in `deepLink`. True of every game
                between its first `wrangler dev` and its first release, so the
                page says so rather than trailing off after the tagline. */}
            {actions.length > 0 ? <Actions links={actions} /> : <p class="note">Coming soon.</p>}
            {site !== null && site.screenshots.length > 0 && <Screenshots site={site} />}
          </main>
        </Page>,
      ),
      200,
      { "Cache-Control": PAGE_CACHE },
    );
  });

  app.get("/site.webmanifest", async (c) => {
    if (!enabled(c.env)) return c.notFound();
    const origin = new URL(c.req.url).origin;
    const manifest = manifestFor(await hasAppIcons(ctx.webAssets(c.env), origin));
    // `PAGE_CACHE`, not `CRAWLER_CACHE`: this document used to be a constant,
    // and now its icon list depends on what is in `public/`. Holding a day-old
    // copy would leave the first deploy that adds icons still advertising the
    // placeholder, which is exactly when someone is looking.
    return c.body(manifest, 200, { "Content-Type": "application/manifest+json", "Cache-Control": PAGE_CACHE });
  });
}
