import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Runs inside workerd against the real bindings (simulated D1, real DO
// SQLite). D1 migrations are injected as a binding and applied once per
// isolate by test/apply-migrations.ts.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(new URL("./migrations", import.meta.url).pathname);
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./test/wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      include: ["test/**/*.spec.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
