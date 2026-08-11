import { configDefaults, defineConfig } from "vitest/config";

/**
 * The twin fixtures are read with `readFileSync` at collect time, so they are
 * not in Vite's module graph, and `test:watch` would ignore a fixture-only
 * edit: Vitest looks a changed path up in the graph, finds nothing, and reruns
 * nothing. `forceRerunTriggers` is the supported way to watch a file consumed
 * outside the graph, and Vitest's own defaults use it for `package.json` and
 * the config files for exactly that reason.
 *
 * Spread the defaults rather than replacing them. Config resolution is a
 * shallow merge, so a bare array silently stops manifest and config edits from
 * triggering a rerun.
 *
 * A match reruns the whole suite rather than one file. That is cheap here
 * because these tests are pure Node. Keep the trigger off any
 * `@cloudflare/vitest-pool-workers` project added later, where a fixture
 * cannot change the result and the rebuild is not free.
 */
export default defineConfig({
  test: {
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, "**/src/module/fixtures/**/*.json"],
  },
});
