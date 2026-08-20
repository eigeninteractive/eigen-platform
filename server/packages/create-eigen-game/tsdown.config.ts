import { defineConfig } from "tsdown";

export default defineConfig({
  entry: { index: "src/index.ts", cli: "src/cli.ts" },
  format: "esm",
  platform: "node",
  fixedExtension: false,
  target: "node22",
  sourcemap: true,
  dts: { sourcemap: true, compilerOptions: { inlineSources: true } },
  clean: true,
  nodeProtocol: false,
});
