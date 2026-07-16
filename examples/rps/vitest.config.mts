import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Workers-pool tests only (run inside workerd against the real bindings).
// Pure rules tests live under test/unit/ and run in Node via
// vitest.unit.config.mts — see the `test` script.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  test: {
    include: ["test/*.spec.ts"],
  },
});
