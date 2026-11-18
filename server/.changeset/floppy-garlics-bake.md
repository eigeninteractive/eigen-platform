---
"@eigeninteractive/server": minor
"create-eigen-game": patch
---

Adopt Drizzle ORM and Kit 1.0.0-rc.5 with fresh D1 and SQLite Durable Object migration baselines. Use table-level snake-case naming and explicit primary-key nullability. Wrangler and the scaffolder consume the nested D1 migrations directly; disposable development databases must be recreated, with no legacy migration adapter.
