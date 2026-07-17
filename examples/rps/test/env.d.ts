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
  }
}
