/**
 * Deep linking & share pages (engine_stack.md §2.4) — the game worker is the
 * link host. Three unauthed, non-OpenAPI routes, generated from the
 * `deepLink` config so there is one source of truth and no hand-maintained
 * JSON:
 *
 *   - `GET /.well-known/assetlinks.json` — Android App Links verification.
 *   - `GET /.well-known/apple-app-site-association` — iOS Universal Links
 *     (extensionless, served as `application/json` — the historic gotcha a
 *     static file gets wrong).
 *   - `GET /j/:shortCode` — the share/landing page. With App Links / Universal
 *     Links an installed app opens the https URL directly, so this page is the
 *     **not-installed fallback**: real OG tags from the D1 summary for rich
 *     unfurls, plus store links.
 *
 * These sit OUTSIDE `/api`. They need no `run_worker_first` entry: a request
 * matching no static file falls through to the worker on its own — the only
 * rule is not to add a `public/` file that shadows one of these paths.
 */

import { readGameByCode, readPlayers } from "../d1/reads.js";
import type { DeepLinkConfig, EngineApp, RouteContext } from "../engine.js";

/** Minimal HTML-escape for values interpolated into the landing page / OG tags
 * (display names are user-controlled). */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function landingPage(appName: string, title: string, description: string, storeLinks: { label: string; url: string }[]): string {
  const buttons = storeLinks.map((l) => `<a class="store" href="${esc(l.url)}">${esc(l.label)}</a>`).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta name="description" content="${esc(description)}"><style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.5rem;text-align:center;line-height:1.5}.store{display:inline-block;margin:.5rem;padding:.6rem 1.1rem;border-radius:.5rem;background:#111;color:#fff;text-decoration:none}</style></head><body><h1>${esc(title)}</h1><p>${esc(description)}</p><div>${buttons}</div><p style="margin-top:2rem;color:#888;font-size:.9rem">Open this link on your phone to join in ${esc(appName)}.</p></body></html>`;
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
    // `paths` form, broadly supported; `/j/*` is the only linked path.
    const body = JSON.stringify({ applinks: { apps: [], details: [{ appID: cfg.apple.appId, paths: ["/j/*"] }] } });
    app.get("/.well-known/apple-app-site-association", (c) => c.body(body, 200, { "Content-Type": "application/json" }));
  }

  // The share/landing page — the not-installed fallback (§2.4).
  app.get("/j/:shortCode", async (c) => {
    const stores: { label: string; url: string }[] = [];
    if (cfg.apple?.storeUrl !== undefined) stores.push({ label: "App Store", url: cfg.apple.storeUrl });
    if (cfg.android?.storeUrl !== undefined) stores.push({ label: "Google Play", url: cfg.android.storeUrl });

    const game = await readGameByCode(ctx.d1(c.env), c.req.param("shortCode").toUpperCase());
    if (game === undefined) {
      return c.html(landingPage(appName, `${appName}`, "This invite link is no longer valid.", stores), 404);
    }
    const joinable = game.status === "waiting" || game.status === "ready";
    const [host] = game.createdBy === null ? [] : await readPlayers(ctx.d1(c.env), [game.createdBy]);
    const hostName = host?.displayName ?? "Someone";
    const openSeats = Math.max(0, game.maxPlayers - game.participants.length);
    const description = joinable ? `${hostName} invited you${openSeats > 0 ? ` · ${openSeats} seat${openSeats === 1 ? "" : "s"} open` : ""}.` : `This game is ${game.status}.`;
    return c.html(landingPage(appName, `Join ${hostName} in ${appName}`, description, stores), 200);
  });
}
