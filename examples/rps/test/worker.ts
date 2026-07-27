/**
 * The test worker: the production entry's exact config with the engine's
 * test verifier swapped in (`@eigeninteractive/server/testing`), so specs mint their own
 * tokens against the local JWKS while every other code path stays real.
 * Bound by test/wrangler.jsonc; never deployed.
 */

import { createEngine } from "@eigeninteractive/server";
import { testVerifier } from "@eigeninteractive/server/testing";
import rpsGame from "../src/module";

export { GameDO } from "../src/index";

export default createEngine({
  gameModule: rpsGame,
  appName: "RPS",
  d1: (env: Env) => env.rps_dev,
  gameDO: (env: Env) => env.GAME_DO,
  auth: testVerifier(),
});
