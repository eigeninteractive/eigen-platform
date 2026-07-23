import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/openapi.ts", "src/testing.ts"],
  format: "esm",
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["cloudflare:workers"],
  // Inline non-JS sources as text so implementors need no wrangler Text rule:
  // drizzle's durable-sqlite migrations bundle imports its .sql file, and the
  // public pages' stylesheet is authored as a real .css file.
  loader: { ".sql": "text", ".css": "text" },
});
