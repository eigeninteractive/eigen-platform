import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts", "src/contract-cli.ts", "src/inspect-cli.ts", "src/local-state.ts"],
  format: "esm",
  sourcemap: true,
  // tsup rewrites `node:foo` imports to bare `foo` by default, for consumers
  // old enough to predate the prefix. That is silently wrong for one import
  // here: `node:sqlite` has no bare alias, so the rewrite produced a built CLI
  // that failed at run time with ERR_MODULE_NOT_FOUND for a package called
  // "sqlite". Keep the prefixes; every consumer of this package is Node 24+.
  removeNodeProtocol: false,
  // See `packages/server/tsup.config.ts`: cleaning between watch rebuilds
  // empties `dist/` under a linked game that is reading it.
  clean: !options.watch,
}));
