import { defineConfig } from "tsdown";

export default defineConfig((options) => ({
  entry: {
    index: "src/index.ts",
    "contract-cli": "src/contract-cli.ts",
    "inspect-cli": "src/inspect-cli.ts",
    "local-state": "src/local-state.ts",
  },
  format: "esm",
  platform: "node",
  fixedExtension: false,
  sourcemap: true,
  dts: { sourcemap: true, compilerOptions: { inlineSources: true } },
  clean: !options.watch,
  // Preserve explicit `node:` imports, including `node:sqlite`, which has no
  // legacy bare-module alias.
  nodeProtocol: false,
}));
