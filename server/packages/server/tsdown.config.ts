import { defineConfig } from "tsdown";

export default defineConfig((options) => ({
  entry: {
    index: "src/index.ts",
    openapi: "src/openapi.ts",
    testing: "src/testing.ts",
  },
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  dts: { sourcemap: true, compilerOptions: { inlineSources: true } },
  clean: !options.watch,
  deps: { neverBundle: ["cloudflare:workers"] },
  // The Worker inserts its stylesheet into a complete HTML page, so the
  // `.css.txt` asset is intentionally loaded as text rather than emitted as a
  // browser asset. SQL is bundled for the same implementor-transparent reason.
  loader: { ".sql": "text", ".txt": "text" },
}));
