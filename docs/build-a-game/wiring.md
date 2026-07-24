---
sidebar_position: 8
title: Wiring it into a Worker
description: The two pieces of glue from @eigen/server, what wrangler.jsonc must declare, and optional rate limiting.
---

# Wiring it into a Worker

Two small pieces of glue, both from `@eigen/server`:

```ts
// src/index.ts
import { BaseGameDO, createEngine } from "@eigen/server";
import { gameModule } from "./rules/index.js";

// 1. Bind the game's Durable Object to your game module + D1.
export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;
  protected d1(env: Env) { return env.MY_D1; }
}

// 2. Export the Worker.
export default createEngine({
  gameModule,
  appName: "Rock Paper Scissors",
  d1:     (env: Env) => env.MY_D1,
  gameDO: (env: Env) => env.GAME_DO,
  // Optional feature blocks — omit to leave a feature off:
  // deepLink:  { android: {...}, apple: {...} },
  // avatars:   { bucket: (env) => env.AVATARS },
  // site:      { tagline: "…", primaryColor: "#…", operator: {…} },
  // lifecycle: { guestMaxAgeMs: … },
});
```

You pass **accessors**, not binding names — the engine reads each binding off
*your* `Env`, so you can call them whatever you like in `wrangler.jsonc`. The
config's type parameters infer from these accessors.

Your `wrangler.jsonc` declares: the `GameDO` Durable Object (SQLite storage, via
the `exports` field), your D1 database, a daily `cron` trigger (the lifecycle
backstop), `nodejs_compat`, and — if you use them — an R2 bucket for avatars and
a `public/` assets directory. Set `FIREBASE_PROJECT_ID` (required for auth); add
the `FIREBASE_*` service-account trio to enable push, and `BOT_SIGNING_SECRET`
to enable external bots.

You do **not** write D1 migrations — the engine owns its schema and ships the
migrations; you apply them with `wrangler d1 migrations apply` at deploy. The
per-game DO schema self-applies. (If you need your own app-specific tables, that
is a *separate* D1 database with its own migrations — never the engine's.)

For the full binding table, see [Configuration](../operate/configuration.md).
For the `site` block, see [The game's web surface](../operate/web-surface.md#configuring-the-site-block).

## Rate limiting (optional)

The engine per-user rate-limits the write endpoints that are cheap to spam —
game creation, friend requests, user search, and avatar uploads — using the
Workers [`ratelimit`](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
binding. It's **off until you bind it, and needs no code**: the engine resolves
each limiter by a fixed `EIGEN_RATE_LIMIT_*` binding name, so declaring the block
below in `wrangler.jsonc` is the entire setup. A limiter you don't bind is simply
unlimited.

```jsonc
// wrangler.jsonc — recommended starting values
"ratelimits": [
  { "name": "EIGEN_RATE_LIMIT_AVATAR_UPLOAD",  "namespace_id": "1001", "simple": { "limit": 5,  "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_GAME_CREATE",    "namespace_id": "1002", "simple": { "limit": 10, "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_FRIEND_REQUEST", "namespace_id": "1003", "simple": { "limit": 20, "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_USER_SEARCH",    "namespace_id": "1004", "simple": { "limit": 20, "period": 10 } }
]
```

The **`name`** must match exactly (that's how the engine finds the binding); the
**`limit`/`period`** are yours to tune — the engine never reads them, the
platform enforces them, and `period` may only be `10` or `60`. Each
**`namespace_id`** is a positive integer that **must be unique within your
Cloudflare account**: ids are account-scoped, so reusing one across two Workers
makes them share counters. A limited caller gets `429` with
`code: "rate_limited"` and a `Retry-After` header. The binding is per-colo and
eventually consistent — an abuse dampener, not a hard quota.
