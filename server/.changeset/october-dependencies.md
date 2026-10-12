---
"@eigeninteractive/server": patch
"create-eigen-game": patch
---

Raise dependency floors to the October releases: `hono` 4.13.13, `drizzle-orm` 0.45.4 and `zod` 4.6.5 in the server, and `@clack/core` 1.5.1 and `@clack/prompts` 1.8.1 in the scaffolder. A scaffolded game now pins Biome 2.5.15, and its release workflow uses `actions/setup-java@v6`, matching the other actions it tracks by major version.
