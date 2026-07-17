/**
 * Test bindings for `import { env } from "cloudflare:workers"`, which is
 * typed as the global `Cloudflare.Env` (the same namespace `wrangler types`
 * populates for a deployable worker). Declared by hand here so the DO
 * namespace carries the RPC surface — mirrors test/wrangler.jsonc plus the
 * TEST_MIGRATIONS binding injected by vitest.config.mts.
 */

import type { D1Migration } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      GAME_DO: DurableObjectNamespace<import("./worker.js").GameDO>;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
