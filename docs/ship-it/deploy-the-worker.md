---
sidebar_position: 1
title: Deploy the Worker
description: The fifteen lines of glue that turn a GameModule into a Worker, what wrangler.jsonc must declare, running it locally with nothing simulated away, and the first-deploy checklist.
---

# Deploy the Worker

Your game's server is a single Cloudflare Worker. It owns its own domain,
database and players, and it is about fifteen lines of glue around your
`GameModule`.

## The glue

Two pieces, both from `@eigeninteractive/server`:

```ts
// src/index.ts
import { BaseGameDO, createEngine } from "@eigeninteractive/server";
import gameModule from "./module/index.js";

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
  // deepLink:  { android: {…}, apple: {…} },
  // avatars:   { bucket: (env) => env.AVATARS },
  // site:      { tagline: "…", primaryColor: "#…", operator: {…} },
  // lifecycle: { guestMaxAgeMs: … },
});
```

You pass **accessors, not binding names** — the engine reads each binding off
*your* `Env`, so you can call them whatever you like in `wrangler.jsonc`, and the
config's type parameters infer from the accessors.

## What `wrangler.jsonc` declares

The `GameDO` Durable Object (SQLite storage, via the `exports` field), your D1
database, a daily `cron` trigger (the lifecycle backstop), `nodejs_compat`, and —
if you use them — an R2 bucket for avatars and a `public/` assets directory. Set
the required Firebase trio (`FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`) from the same project used
by the app. Set `WEB_APP_ORIGIN` for absolute web-notification links and as the
automatically trusted browser origin for local or deliberately split hosting.
Set `clientOrigins` only to replace that convention with multiple or
non-standard browser origins. Add `BOT_SIGNING_SECRET` to enable external bots.

You do **not** write D1 migrations. The engine owns its schema and ships them;
you apply them at deploy. The per-game Durable Object schema self-applies. If you
need your own app-specific tables, that is a *separate* D1 database with its own
migrations — never the engine's.

The full binding table is in [Configuration](./configure.md).

## Running it locally

Pure engine tests need no Cloudflare account, Firebase project, or payment
method. Running the complete Worker and Flutter app together uses the Firebase
project required by Auth.

```bash
pnpm install
pnpm -r build           # packages resolve through exports → dist
pnpm -r test
pnpm -r typecheck

cd examples/rps         # or your own worker
pnpm dev                # wrangler dev — local DO, D1, R2 and cron simulation
```

Three things make that true:

- **Everything is simulated.** `wrangler dev` runs Durable Objects, their SQLite,
  D1, the cron trigger and R2 locally. Avatar upload and serving are developed
  entirely against the local R2 simulation; a real bucket enters only at a deploy
  with uploads enabled.
- **Full-app development uses the real Firebase project.** Copy
  `.dev.vars.example` to the git-ignored `.dev.vars` and fill the
  service-account email and private key. The project ID and web origin remain
  in `wrangler.jsonc`; the credentials belong to that same Firebase project,
  not a second backend.
- **Auth is testable without Firebase.** `@eigeninteractive/server/testing` mints local
  tokens the auth middleware accepts, so integration tests exercise the real
  middleware, the real Durable Object and the real D1 with no Firebase project
  or outbound FCM calls.

:::tip Tests run in the real runtime

Tests run under `@cloudflare/vitest-pool-workers`, inside the real `workerd`
runtime — so a passing test has exercised the actual input gate, the actual
SQLite and the actual alarm scheduler, not a mock of them.

:::

## Rate limiting (optional)

The engine per-user rate-limits the write endpoints that are cheap to spam — game
creation, friend requests, user search and avatar uploads — using the Workers
[`ratelimit`](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
binding. It is **off until you bind it, and needs no code**: the engine resolves
each limiter by a fixed binding name, so declaring the block below is the entire
setup. A limiter you do not bind is simply unlimited.

```jsonc
// wrangler.jsonc — recommended starting values
"ratelimits": [
  { "name": "EIGEN_RATE_LIMIT_AVATAR_UPLOAD",  "namespace_id": "1001", "simple": { "limit": 5,  "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_GAME_CREATE",    "namespace_id": "1002", "simple": { "limit": 10, "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_FRIEND_REQUEST", "namespace_id": "1003", "simple": { "limit": 20, "period": 60 } },
  { "name": "EIGEN_RATE_LIMIT_USER_SEARCH",    "namespace_id": "1004", "simple": { "limit": 20, "period": 10 } }
]
```

The **`name`** must match exactly — that is how the engine finds the binding. The
**`limit`/`period`** are yours to tune; the engine never reads them, the platform
enforces them, and `period` may only be `10` or `60`. Each **`namespace_id`** is
a positive integer that **must be unique within your Cloudflare account**, since
ids are account-scoped and reusing one across two Workers makes them share
counters. A limited caller gets `429` with `code: "rateLimited"` and a
`Retry-After` header. The binding is per-colo and eventually consistent — an
abuse dampener, not a hard quota.

## Deploying

```bash
pnpm exec wrangler secret put FIREBASE_CLIENT_EMAIL
pnpm exec wrangler secret put FIREBASE_PRIVATE_KEY
pnpm exec wrangler secret put BOT_SIGNING_SECRET      # if external bots are wanted
pnpm deploy              # = wrangler d1 migrations apply --remote && wrangler deploy
```

Migrations apply **before** the code goes out, so new code never meets an old
schema. Secrets persist across deploys and do not need re-setting.

### First-deploy checklist

- [ ] `FIREBASE_PROJECT_ID` set to the real project — an empty value 500s every
      authed request and is the single most common misconfiguration.
- [ ] `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` stored as Worker
      secrets from that same project's service-account JSON. Missing values
      reject authenticated traffic.
- [ ] `WEB_APP_ORIGIN` is the exact deployed Flutter origin, and the same domain is
      authorized in Firebase Auth.
- [ ] D1 database created and its `database_id` written into `wrangler.jsonc`.
- [ ] Cron trigger declared. Without it the guest purge and abandoned-game reap
      never run, and untimed abandoned games accumulate forever.
- [ ] `deepLink` block filled with the **release** signing cert's SHA-256 and the
      real store URLs, matching the app's own declarations — see
      [Deep links](./deep-links.md).
- [ ] Bots inserted for any game that offers solo play.
- [ ] If avatars are enabled: `wrangler r2 bucket create`. **This is the point a
      payment method is first required.**
- [ ] `openapi.json` re-emitted and the Dart client regenerated from it.

### What `/health` proves

`GET /health` is public, unauthed and returns `{"status":"ok"}` — the thing to
curl after a deploy, and the endpoint to point an uptime monitor at.

Be clear about what it proves: **the Worker is deployed and routable, nothing
more.** It performs no I/O by design — no D1 query, no Durable Object wake, no
config disclosure — which is exactly what makes it safe to leave open. It costs
one invocation, the same as the 404 any unknown path already returns, so it adds
no amplification surface and needs no rate limiting. It answers 200 even with a
garbage `Authorization` header, so a monitor never mistakes an auth problem for
an outage, and it is served `no-store` so a cached 200 cannot keep reporting
healthy after the Worker stops being able to serve.

What it therefore does **not** catch is the most common misconfiguration —
missing Firebase project or Admin values, which 500 every authed request while
`/health` stays green. Verifying that needs a real authed call, which is why the
checklist leads with it. A deeper readiness check that pinged D1 and asserted
config would be both a cost multiplier and a config leak on an unauthed route;
if you want one, put it behind a secret rather than opening it.

It is deliberately absent from `openapi.json`: it is an operator endpoint, and
including it would generate a Dart client method no app ever calls.

## Host story

With a bought domain, configure the Worker as that hostname's origin:

```jsonc
"workers_dev": false,
"preview_urls": false,
"routes": [{ "pattern": "rps.example.com", "custom_domain": true }]
```

This gives Flutter web, API, app links, legal pages, and `/download` one host;
Cloudflare provisions its DNS record and certificate. The free
`<name>.<account>.workers.dev` subdomain is useful before the custom domain is
ready. Commit `workers_dev: false` for production: changing it only in the
dashboard lets the next Wrangler deploy re-enable that second public origin.

Avatars may require a paid Cloudflare plan at real scale; FCM itself is a
no-cost Firebase product.
