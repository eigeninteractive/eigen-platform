import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts"],
  format: "esm",
  sourcemap: true,
  // See `packages/server/tsup.config.ts`: cleaning between watch rebuilds
  // empties `dist/` under a linked game that is reading it.
  clean: !options.watch,
}));
