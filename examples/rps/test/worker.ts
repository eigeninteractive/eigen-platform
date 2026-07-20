/**
 * The test worker: the production entry's exact config with the engine's
 * test verifier swapped in (`@eigen/server/testing`), so specs mint their own
 * tokens against the local JWKS while every other code path stays real.
 * Bound by test/wrangler.jsonc; never deployed.
 */

import { createEngine } from "@eigen/server";
import { testVerifier } from "@eigen/server/testing";
import { gameModule as rpsGame } from "../src/rules";

export { GameDO } from "../src/index";

export default createEngine({
  gameModule: rpsGame,
  appName: "RPS",
  d1: (env: Env) => env.rps_dev,
  gameDO: (env: Env) => env.GAME_DO,
  auth: testVerifier(),
});
