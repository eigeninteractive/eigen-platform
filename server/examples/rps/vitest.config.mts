import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Workers-pool tests only (run inside workerd against the real bindings).
// Pure rules tests live under test/unit/ and run in Node via
// vitest.unit.config.mts; see the `test` script.
export default defineConfig(async () => {
  const migrationsDir = "node_modules/@eigeninteractive/server/migrations";
  const migrations = await readD1Migrations({
    projectPath: new URL(".", import.meta.url).pathname,
    migrationsDir,
    migrationsPattern: `${migrationsDir}/*/migration.sql`,
  });
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
      include: ["test/*.spec.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
