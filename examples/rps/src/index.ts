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
  // Per-user write rate limits need NO wiring here: the engine resolves each
  // limiter by the conventional binding name, and the `ratelimits` block in
  // wrangler.jsonc is the pasted `defaultRateLimitsConfig()`. Supply `rateLimit`
  // only to back a limiter differently.
});
