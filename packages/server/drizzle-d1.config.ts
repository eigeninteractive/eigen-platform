import { defineConfig } from "drizzle-kit";

/** D1 schema (§5.2) — engine-private, like the DO's. Plain .sql migrations,
 * shipped in the package's `migrations/` dir; the app's `deploy` script runs
 * `wrangler d1 migrations apply` before `wrangler deploy` — never at runtime,
 * and never seen by implementors (app-custom data lives in a separate D1). */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/d1/schema.ts",
  out: "./migrations",
});
