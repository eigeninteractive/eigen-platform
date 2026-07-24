---
sidebar_position: 2
title: Local development
description: Everything simulated, no cloud account and no payment method — and why tests run in the real workerd runtime.
---

# Local development

The engine is a pnpm workspace; the example Worker under `examples/rps` is the
reference implementor app and the thing you actually run.

```bash
pnpm install
pnpm -r test            # all four packages: kernel, rules, server, testkit
pnpm -r typecheck
pnpm exec biome check   # lint + format

cd examples/rps
pnpm dev                # wrangler dev — local DO, local D1, local R2 simulation
pnpm test               # the example's integration + unit suites
```

Three things make local development need no cloud account and no payment method:

- **Everything is simulated.** `wrangler dev` runs Durable Objects, their
  SQLite, D1, the cron trigger, and R2 locally. Avatar upload/serve is developed
  entirely against the local R2 simulation; a real bucket enters only at a deploy
  with uploads enabled.
- **Local secrets are placeholders.** `.dev.vars` (git-ignored) carries a
  placeholder `FIREBASE_*` trio and a dev `BOT_SIGNING_SECRET`. Push degrades to
  a logged no-op, which is the intended local behaviour — do not put real
  credentials there to "make push work" locally.
- **Auth is testable without Firebase.** `@eigen/server/testing` mints local
  tokens the auth middleware accepts, so integration tests exercise the real
  middleware, the real DO, and the real D1 without a Firebase project. This is
  the same seam the engine's own suites use.

:::tip Tests run in the real runtime

Tests run under `@cloudflare/vitest-pool-workers`, i.e. inside the real
`workerd` runtime — so a test that passes has exercised the actual DO input
gate, the actual SQLite, and the actual alarm scheduler, not a mock of them.

:::

See [Testing your game](../build-a-game/testing.md) for how to drive your own
rules through this.
