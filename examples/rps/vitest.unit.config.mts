import { configDefaults, defineConfig } from "vitest/config";

// Plain-Node vitest for the pure side of the game: the twin-fixture suite and
// kernel-level scenarios over the rules unit. No workerd, no bindings.
//
// `forceRerunTriggers` carries the fixtures, which `twinFixtureTests` reads
// with `readFileSync` at collect time and Vite therefore never sees. Without
// it a fixture-only edit reruns nothing in watch mode. Spread the defaults:
// config resolution is a shallow merge, so a bare array drops them.
//
// Deliberately not set on vitest.config.mts, the workers-pool project: a
// fixture cannot change a workerd result, and the rebuild is not free.
export default defineConfig({
  test: {
    include: ["test/unit/**/*.spec.ts"],
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, "**/src/module/fixtures/**/*.json"],
  },
});
