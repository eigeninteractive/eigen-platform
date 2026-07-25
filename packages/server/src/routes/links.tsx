/**
 * Deep linking & share pages — the game worker is the link host. Three
 * unauthed, non-OpenAPI routes, generated from the `deepLink` config so there
 * is one source of truth and no hand-maintained JSON:
 *
 *   - `GET /.well-known/assetlinks.json` — Android App Links verification.
 *   - `GET /.well-known/apple-app-site-association` — iOS Universal Links
 *     (extensionless, served as `application/json` — the historic gotcha a
 *     static file gets wrong).
 *   - `GET /join/:shortCode` — the invite/share landing page.
 *   - `GET /game/:gameId` — a specific game's landing page (replay / spectate).
 *
 *     Both are the **not-installed fallback**: with App Links / Universal Links
 *     an installed app opens the https URL directly, so these render only when
 *     the app is absent — real OG tags from the D1 summary for rich unfurls,
 *     plus store links.
 *
 * These sit OUTSIDE `/api`. They need no `run_worker_first` entry: a request
 * matching no static file already falls through to the worker, so the only rule
 * is not to add a `public/` file that shadows one of these paths.
 *
 * **The app owns two path prefixes, `/join` and `/game`.** `/join/:code` is the
 * invite/share landing; `/game/:id` is a specific game (the app's replay links
 * and its push-notification deep links). `assetlinks.json` grants
 * `handle_all_urls` for the whole host, so the app claims only the paths its
 * `<intent-filter>` declares — `android:pathPrefix="/join"` and
 * `android:pathPrefix="/game"`. Everything else on the host — the `site`
 * group's `/`, `/terms`, `/privacy`, `/delete-account` — is deliberately left
 * unclaimed so it opens in the browser. iOS mirrors this in the AASA `paths`
 * below.
 */

import type { GameWithRoster } from "../d1/reads.js";
import { readGame, readGameByCode, readPlayers } from "../d1/reads.js";
import type { DeepLinkConfig, EngineApp, RouteContext } from "../engine.js";
import { Page, renderDocument } from "../site/page.js";

/** The share/landing page: the not-installed fallback, and the source of the
 * OG tags a chat client unfurls. `noindex` because it is ephemeral and
 * per-game — unfurl scrapers still read the OG tags, which is what matters.
 *
 * `origin` is the request origin, so the OG image URL is absolute — which
 * unfurl scrapers require. */
function SharePage({ appName, title, description, stores, ctx, origin }: { appName: string; title: string; description: string; stores: { label: string; url: string }[]; ctx: RouteContext; origin: string }) {
  return (
    <Page title={title} description={description} siteName={appName} noindex primaryColor={ctx.site?.primaryColor} operatorName={ctx.site?.operator.name} ogImage={ctx.site === null ? undefined : `${origin}${ctx.site.ogImage}`}>
      <h1>{title}</h1>
      <p class="lead">{description}</p>
      <div>
        {stores.map((s) => (
          <a class="btn" href={s.url}>
            {s.label}
          </a>
        ))}
      </div>
      <p class="meta">Open this link on your phone in {appName}.</p>
    </Page>
  );
}

/** The store buttons, built once from the deep-link config. */
function storesFor(cfg: DeepLinkConfig): { label: string; url: string }[] {
  const stores: { label: string; url: string }[] = [];
  if (cfg.apple?.storeUrl !== undefined) stores.push({ label: "App Store", url: cfg.apple.storeUrl });
  if (cfg.android?.storeUrl !== undefined) stores.push({ label: "Google Play", url: cfg.android.storeUrl });
  return stores;
}

/** A "A vs B" line from the roster, in seat order, for the OG description of a
 * public game. Humans resolve to their display name; bots read as "Bot". Null
 * when there is nothing nameable to show. */
async function versusLine(d1: D1Database, game: GameWithRoster): Promise<string | null> {
  if (game.participants.length === 0) return null;
  const humanIds = game.participants.filter((p) => p.userId !== null).map((p) => p.userId as string);
  const names = new Map((await readPlayers(d1, humanIds)).map((u) => [u.id, u.displayName]));
  const parts = game.participants.map((p) => (p.type === "bot" ? "Bot" : (names.get(p.userId ?? "") ?? "Someone")));
  return parts.join(" vs ");
}

export function registerLinkRoutes(app: EngineApp, ctx: RouteContext): void {
  const cfg = ctx.deepLink as DeepLinkConfig;
  const appName = ctx.appName;

  if (cfg.android !== undefined) {
    const body = JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: cfg.android.packageName, sha256_cert_fingerprints: cfg.android.sha256CertFingerprints } }]);
    app.get("/.well-known/assetlinks.json", (c) => c.body(body, 200, { "Content-Type": "application/json" }));
  }

  if (cfg.apple !== undefined) {
    // Extensionless AASA — the content type MUST be application/json. Legacy
    // `paths` form, broadly supported. Both app prefixes are listed; the site
    // group's pages are deliberately absent, which is what keeps Universal
    // Links off `/terms` and friends.
    const body = JSON.stringify({ applinks: { apps: [], details: [{ appID: cfg.apple.appId, paths: ["/join/*", "/game/*"] }] } });
    app.get("/.well-known/apple-app-site-association", (c) => c.body(body, 200, { "Content-Type": "application/json" }));
  }

  const stores = storesFor(cfg);
  // The OG image URL must be absolute; build it from the request origin.
  const originOf = (url: string): string => new URL(url).origin;

  // The invite/share landing — the not-installed fallback for a `/join/:code`.
  app.get("/join/:shortCode", async (c) => {
    const origin = originOf(c.req.url);
    const game = await readGameByCode(ctx.d1(c.env), c.req.param("shortCode").toUpperCase());
    if (game === undefined) {
      return c.html(renderDocument(<SharePage appName={appName} title={appName} description="This invite link is no longer valid." stores={stores} ctx={ctx} origin={origin} />), 404);
    }
    const joinable = game.status === "waiting" || game.status === "ready";
    const [host] = game.createdBy === null ? [] : await readPlayers(ctx.d1(c.env), [game.createdBy]);
    const hostName = host?.displayName ?? "Someone";
    const openSeats = Math.max(0, game.maxPlayers - game.participants.length);
    const description = joinable ? `${hostName} invited you${openSeats > 0 ? ` · ${openSeats} seat${openSeats === 1 ? "" : "s"} open` : ""}.` : `This game is ${game.status}.`;
    return c.html(renderDocument(<SharePage appName={appName} title={`Join ${hostName} in ${appName}`} description={description} stores={stores} ctx={ctx} origin={origin} />), 200);
  });

  // A specific game's landing — the not-installed fallback for a `/game/:id`
  // replay/spectate link, and the push-notification deep link's target when the
  // app is absent. Keyed by game id (not the short code).
  app.get("/game/:gameId", async (c) => {
    const origin = originOf(c.req.url);
    const game = await readGame(ctx.d1(c.env), c.req.param("gameId"));
    if (game === undefined) {
      return c.html(renderDocument(<SharePage appName={appName} title={appName} description="This game link is no longer valid." stores={stores} ctx={ctx} origin={origin} />), 404);
    }
    // A private game's roster must not leak to an unauthenticated visitor — the
    // app authorizes the viewer before showing a replay, this page cannot. Show
    // a generic card and let the app do the gating.
    if (game.access !== "public") {
      return c.html(renderDocument(<SharePage appName={appName} title={appName} description={`Open this game in ${appName}.`} stores={stores} ctx={ctx} origin={origin} />), 200);
    }
    const vs = await versusLine(ctx.d1(c.env), game);
    const suffix = vs === null ? "" : ` — ${vs}`;
    const description = game.status === "finished" ? `See how this game of ${appName} played out${suffix}.` : `Watch this game of ${appName}${suffix}.`;
    return c.html(renderDocument(<SharePage appName={appName} title={vs === null ? appName : `${vs} · ${appName}`} description={description} stores={stores} ctx={ctx} origin={origin} />), 200);
  });
}
