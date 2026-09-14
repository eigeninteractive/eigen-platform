import { defineConfig } from "tsdown";

export default defineConfig((options) => ({
  entry: { index: "src/index.ts" },
  format: "esm",
  // An adapter runs inside the Worker, so it bundles for the same neutral
  // platform the engine does and reaches for `fetch` and Web Crypto only.
  platform: "neutral",
  sourcemap: true,
  dts: { sourcemap: true, compilerOptions: { inlineSources: true } },
  clean: !options.watch,
}));
