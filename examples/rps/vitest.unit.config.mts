import { defineConfig } from "vitest/config";

// Plain-Node vitest for the pure side of the game: the twin-fixture suite and
// kernel-level scenarios over the rules unit. No workerd, no bindings.
export default defineConfig({
  test: {
    include: ["test/unit/**/*.spec.ts"],
  },
});
