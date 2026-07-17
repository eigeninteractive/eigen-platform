import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["cloudflare:workers"],
  // The drizzle durable-sqlite migrations bundle imports its .sql file; inline
  // it as text so implementors need no wrangler Text rule.
  loader: { ".sql": "text" },
});
