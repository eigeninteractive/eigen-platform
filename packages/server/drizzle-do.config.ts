import { defineConfig } from "drizzle-kit";

/** The per-game Durable Object's SQLite schema. The `durable-sqlite` driver emits a bundled
 * `migrations.js` that compiles into the worker — each game DO migrates
 * itself inside `blockConcurrencyWhile` on activation (no deploy step). */
export default defineConfig({
  dialect: "sqlite",
  driver: "durable-sqlite",
  schema: "./src/do/schema.ts",
  out: "./src/do/migrations",
});
