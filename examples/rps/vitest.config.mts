import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Workers-pool tests only (run inside workerd against the real bindings).
// Pure rules tests live under test/unit/ and run in Node via
// vitest.unit.config.mts — see the `test` script.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(new URL("./node_modules/@eigen/server/migrations", import.meta.url).pathname);
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      include: ["test/*.spec.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
