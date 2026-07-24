---
sidebar_position: 1
title: Quickstart
description: Run the reference game locally in a few minutes — no Cloudflare account, no Firebase project, no payment method.
---

# Quickstart

The fastest way to understand the engine is to run the reference game. Nothing
here needs a Cloudflare account, a Firebase project, or a payment method:
`wrangler dev` simulates Durable Objects, their SQLite, D1, R2 and the cron
trigger locally.

## Prerequisites

- Node (see `.nvmrc`) and **pnpm**
- No cloud credentials

## Run it

```bash
git clone https://github.com/eigeninteractive/eigen-server
cd eigen-server
pnpm install

pnpm -r build        # the packages resolve through exports → dist
pnpm -r test         # kernel, rules, server, testkit
pnpm -r typecheck
```

Then start the example Worker — Rock-Paper-Scissors, the reference implementor
app:

```bash
cd examples/rps
pnpm dev             # wrangler dev, with local DO / D1 / R2 simulation
```

Check it is up:

```bash
curl http://localhost:8787/health
# {"status":"ok"}
```

`/health` is public and does no I/O by design — it proves the Worker is
routable and nothing more. See [what it does and doesn't prove](../operate/deploy.md#what-health-proves).

## What to read next

- **[A complete example — Rock-Paper-Scissors](./your-first-game.md)** — the
  whole game in one file, including the simultaneous-move case.
- **[The mental model](../build-a-game/game-module.md)** — the four facts that
  shape everything you write.
- **[What the engine is](../concepts/overview.md)** — the single principle the
  system is built around, if you'd rather start from the design.

When you're ready to run your own game against a real deployment, the path is
[Configuration](../operate/configuration.md) → [Deploying](../operate/deploy.md).
