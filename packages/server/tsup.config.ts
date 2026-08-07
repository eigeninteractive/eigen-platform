import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.ts", "src/openapi.ts", "src/testing.ts"],
  format: "esm",
  dts: true,
  sourcemap: true,
  // Not while watching. `--watch` cleans before every rebuild, so `dist/` is
  // empty for a moment on each save — and a game linked to this checkout
  // resolves the engine through `dist`, so a `wrangler dev` or `vitest` that
  // reads in that window sees a missing file rather than a stale one. A
  // one-shot build has no such reader and is worth cleaning.
  clean: !options.watch,
  external: ["cloudflare:workers"],
  // Inline non-JS sources as text so implementors need no wrangler Text rule:
  // drizzle's durable-sqlite migrations bundle imports its .sql file, and the
  // public pages' stylesheet is authored as a real .css file.
  loader: { ".sql": "text", ".css": "text" },
}));
