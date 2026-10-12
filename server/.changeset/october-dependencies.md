---
"@eigeninteractive/server": patch
"@eigeninteractive/testkit": minor
"create-eigen-game": patch
---

Move the test toolchain to Vitest 5. `@eigeninteractive/testkit` now peers on `vitest` `^5.0.0`, so a game upgrading it upgrades Vitest in the same step, and the Workers Vitest integration is `@cloudflare/vitest-plugin`, the new name for `@cloudflare/vitest-pool-workers`.

Raise dependency floors to the October releases: `zod` 4.6.6, which checks array, set and map size limits before parsing their elements, plus `hono` 4.13.13 and `drizzle-orm` 0.45.4 in the server, and `@clack/core` 1.5.1 and `@clack/prompts` 1.8.1 in the scaffolder.

A scaffolded game now pins Biome 2.5.15 with `noFloatingPromises` and `noMisusedPromises` turned on, requires Wrangler 4.149, Vitest 5 and Zod 4.6.6, enables Workers Issues in its `wrangler.jsonc`, adds `firebase_core` 4.15.0 to the app, and its release workflow uses `actions/setup-java@v6`, matching the other actions it tracks by major version.
