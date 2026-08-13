/**
 * The test worker: the production entry's config with explicit Firebase test
 * effects (`@eigeninteractive/server/testing`), so specs mint tokens against
 * the local JWKS without contacting Firebase Admin.
 * Bound by test/wrangler.jsonc; never deployed.
 */

import { createEngine } from "@eigeninteractive/server";
import { testFirebaseAdmin, testVerifier } from "@eigeninteractive/server/testing";
import { engineConfig, GameDO as ProductionGameDO } from "../src/index";

export class GameDO extends ProductionGameDO {
  protected firebaseAdmin(_env: Env) {
    return testFirebaseAdmin;
  }
}

export default createEngine({
  ...engineConfig,
  testing: {
    auth: testVerifier(),
    firebaseAdmin: () => testFirebaseAdmin,
  },
});
