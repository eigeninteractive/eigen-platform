---
sidebar_position: 13
title: What the engine owns
description: Everything you get for free and must not reimplement.
---

# What the engine owns (and you never touch)

To keep the boundary crisp, here is everything you get for free and must not
reimplement:

- **Persistence & serialization** — the per-game Durable Object, its SQLite, the
  input gate, versioning, and idempotent retries.
- **The waiting room** — create, join (by id or code), leave, cancel, add-bot,
  start; short codes; guest and friends-access gating.
- **Sockets & reconnection** — one socket per game, pre-game roster snapshots,
  versioned frames, gap recovery by range fetch.
- **Timing** — deadlines, the chess-clock bank, the grace window, the durable
  alarm.
- **Ratings** — OpenSkill, the concurrency-safe CAS, pools, history (you only
  choose the pool via `ratingPool`).
- **Identity & auth** — Firebase token verification, user provisioning, guests,
  account deletion.
- **History & replay** — the immutable transition log, compaction, and the replay
  path (your `computeObservation` is reused to project it).
- **Bots infrastructure**, **push**, **deep links**, **avatars**, and the whole
  **HTTP/OpenAPI surface**.

Your entire job is the pure rules in `@eigen/rules` plus the ~15-line Worker glue.

:::tip A useful smell test

If you find yourself reaching for a database, a socket, a clock, or a lock inside
a hook — stop. The engine already did it, and doing it in a hook would break
determinism.

:::
