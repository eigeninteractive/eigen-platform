---
sidebar_position: 3
title: Deploying
description: The deploy command, what /health does and does not prove, and the first-deploy checklist.
---

# Deploying

```bash
cd examples/rps          # or your own worker
pnpm exec wrangler secret put FIREBASE_CLIENT_EMAIL   # if push/delete is wanted
pnpm exec wrangler secret put FIREBASE_PRIVATE_KEY
pnpm exec wrangler secret put BOT_SIGNING_SECRET      # if external bots are wanted
pnpm deploy              # = wrangler d1 migrations apply --remote && wrangler deploy
```

Migrations apply **before** the code goes out, so the new code never meets an old
schema. Secrets persist across deploys and do not need re-setting.

## What `/health` proves

`GET /health` is public, unauthed and returns `{"status":"ok"}` — the one thing
to curl after a deploy, and the endpoint to point an uptime monitor at:

```bash
curl https://your-worker.example.com/health
```

Be clear about what it proves: **the Worker is deployed and routable, nothing
more.** It performs no I/O by design — no D1 query, no DO wake, no config
disclosure — which is exactly what makes it safe to leave open. It costs one
Worker invocation, the same as the 404 that any unknown path already returns, so
it adds no amplification surface and needs no rate limiting. It answers 200 even
with a garbage `Authorization` header, so a monitor never mistakes an auth
problem for an outage, and it is served `no-store` so a cached 200 cannot keep
reporting healthy after the Worker stops being able to serve.

What it therefore does **not** catch is the most common misconfiguration — an
empty `FIREBASE_PROJECT_ID`, which 500s every authed request while `/health`
stays green. Verifying that needs a real authed call, which is why the checklist
below leads with it. A deeper readiness check that pinged D1 and asserted config
would be both a cost multiplier and a config leak on an unauthed route; if you
want one, put it behind a secret rather than opening it.

It is deliberately absent from `openapi.json`: it is an operator and monitoring
endpoint, and including it would generate a Dart client method no app ever calls.

## Checklist for a first real deploy

- [ ] `FIREBASE_PROJECT_ID` set to the real project (an empty value 500s every
      authed request — the single most common misconfiguration).
- [ ] D1 database created and its `database_id` written into `wrangler.jsonc`.
- [ ] Cron trigger declared — without it the guest purge and abandoned-game reap
      never run, and untimed abandoned games accumulate forever.
- [ ] `deepLink` block filled with the **release** signing cert's SHA-256 and the
      real store URLs, and the client's Android intent-filters /
      iOS associated-domains pointed at the same host.
- [ ] Bots inserted for any game that offers solo play.
- [ ] If avatars are enabled: `wrangler r2 bucket create` (**this is the point a
      payment method is first required**).
- [ ] `openapi.json` re-emitted and the Dart client regenerated from it.

## Host story

With a bought domain, a `custom_domain` on the Worker gives the API and deep
links one host; without one, the free `<name>.<account>.workers.dev` subdomain
works day 0 (App/Universal Links accept any HTTPS host). Avatars and push each
add a payment method only when actually enabled for a deploy.
