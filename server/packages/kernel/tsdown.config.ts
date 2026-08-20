import { defineConfig } from "tsdown";

export default defineConfig((options) => ({
  entry: { index: "src/index.ts" },
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  dts: { sourcemap: true, compilerOptions: { inlineSources: true } },
  clean: !options.watch,
}));
