/**
 * Test-only additions to the generated `Cloudflare.Env`: vitest.config.mts
 * injects TEST_MIGRATIONS via miniflare bindings, which `wrangler types`
 * (rightly) knows nothing about. Included only by test/tsconfig.json.
 */

import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
    /** Types `exports` from `cloudflare:workers`: the loopback bindings for
     * the test worker's top-level exports, so `exports.default.fetch()` (the
     * supported replacement for the deprecated `SELF` fetcher) resolves.
     * `wrangler types` generates this for a deployable worker; the test
     * worker is never deployed, so it is declared by hand here. */
    interface GlobalProps {
      mainModule: typeof import("./worker.js");
      durableNamespaces: "GameDO";
    }
  }
}
