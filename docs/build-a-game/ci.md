---
sidebar_position: 10
title: CI for a game repo
description: The whole workflow, why builds precede typechecks, why you should not deploy from CI, and the half CI cannot see.
---

# CI for a game repo

Everything in [Testing your game](./testing.md) runs offline and needs no
Cloudflare account, so a game's CI is just those commands on a runner. There are
no secrets to inject: the Workers tests boot the real `workerd` with local
D1/R2/DO simulation, and `@eigen/server/testing` mints the tokens, so nothing
reaches the network.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4          # reads `packageManager`, NOT `devEngines`
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm exec biome ci .           # or your linter of choice
      - run: pnpm -r build                  # engine packages resolve via exports → dist
      - run: pnpm -r typecheck
      - run: pnpm -r test                   # twin fixtures + integration
```

`pnpm -r build` before `typecheck` is not optional if your game lives in a
workspace beside the engine packages: they resolve through their `exports` field
to `dist/`, so an unbuilt `@eigen/server` fails to type-check its consumers.

:::danger Do not deploy from CI

`wrangler d1 migrations apply --remote` mutates a real database, and a deploy is
the one action in this system that isn't reversible by re-running a job. Keep it
a deliberate, credentialed `pnpm deploy` from a machine — or, if you do want
push-button deploys, connect the repo to Cloudflare **Workers Builds** so the
deploy is owned by Cloudflare's side rather than by a long-lived API token
sitting in GitHub secrets.

:::

## The half your CI cannot see

Your rules exist twice, in two repos, and **the fixture JSON is duplicated —
there is no sharing mechanism.** The consequence is easy to get wrong:

> Editing a fixture here makes *this* repo's CI green while the client repo
> still holds the old copy. Nothing fails until the client repo's CI next runs —
> possibly days later, on someone else's PR.

So a rules change is a **two-repo change**, and the fixture edit is the part that
must land in both. Copy the same `v<N>/*.json` files into the client repo's
fixture root in the same change. Both runners read `schemaVersion` from inside
the file and expect a `v<N>/` directory layout, so the files are byte-identical
between repos — which is exactly what makes a stale copy invisible.

If the two repos are ever built together (a monorepo, or a CI job that checks out
both as siblings the way a Flutter app's workflow checks out the engine), a
`diff -r` between the two fixture roots is the cheapest possible guard.
