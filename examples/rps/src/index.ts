/**
 * The RPS example worker — the whole implementor surface: the rules
 * module, a `GameDO` subclass binding it, and one `createEngine` call.
 * Deploys with `pnpm deploy` (engine D1 migrations apply, then the code).
 */

import { BaseGameDO, createEngine } from "@eigen/server";
import { gameModule as rpsGame } from "./rules";

export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = rpsGame;
  protected d1(env: Env): D1Database {
    return env.rps_dev;
  }
}

export default createEngine({
  gameModule: rpsGame,
  appName: "RPS",
  d1: (env: Env) => env.rps_dev,
  gameDO: (env: Env) => env.GAME_DO,
  // deep linking: the worker generates the .well-known files + the
  // /j/:shortCode share page from this. Fingerprints/store URLs are
  // placeholders until a real app ships.
  deepLink: {
    android: { packageName: "com.eigeninteractive.rps", sha256CertFingerprints: [], storeUrl: "https://play.google.com/store" },
    apple: { appId: "TEAMID.com.eigeninteractive.rps", storeUrl: "https://apps.apple.com" },
  },
  // opt-in avatars: worker-served (no publicBaseUrl → the relative
  // /avatars/{uid} route). Local R2 simulation under `wrangler dev` — a real
  // bucket enters only at a deploy with uploads enabled.
  avatars: { bucket: (env: Env) => env.AVATARS },
  // The public web surface. This block is the entire setup for the landing
  // page, the three legal documents, and the crawler files (`/sitemap.xml`,
  // `/robots.txt`, `/site.webmanifest`) — no templates to copy, no routes to
  // register. Absolute URLs (canonical/OG/sitemap) come from the request
  // origin, so nothing about the domain is configured here.
  //
  // Any generated page can be replaced by shipping the matching file under
  // `public/` (`public/terms.html` beats `GET /terms`), because Cloudflare
  // serves matching static assets before invoking the worker. `legal` is
  // omitted, so all three documents use the engine's generic templates —
  // review them before publishing a real app; they are a starting point, and
  // the operator carries the liability for what they say.
  //
  // The engine never generates images — but the Flutter app already produces
  // every one it needs. `flutter_launcher_icons` emits `web/favicon.png` and
  // `web/icons/Icon-{192,512}.png` (+ maskable) from the same 1024x1024 source
  // the app icon uses, and `web/og-image.png` is the app's own share card. Copy
  // those into `public/` and the landing page, manifest and OG tags are done;
  // the engine's default paths are exactly those names.
  site: {
    tagline: "Rock, paper, scissors — the smallest complete game on the Eigen engine.",
    primaryColor: "#3f51b5",
    operator: {
      name: "Eigen Interactive",
      jurisdiction: "India",
      contactEmail: "hello@eigeninteractive.com",
      effectiveDate: "1 July 2026",
    },
  },
  // Per-user write rate limits need NO wiring here: the engine resolves each
  // limiter by its conventional `EIGEN_RATE_LIMIT_*` binding name, so the
  // `ratelimits` block in wrangler.jsonc is the whole setup.
});
