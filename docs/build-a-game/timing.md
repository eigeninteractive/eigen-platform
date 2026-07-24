---
sidebar_position: 6
title: Timing
description: Your two timing touchpoints — the timeout lifecycle and the per-action turn_seconds override.
---

# Timing

You mostly get timing for free — a game is created in one of three modes (per-turn
budget, chess-clock bank + optional increment, or untimed), the client picks the
values, and the engine enforces the deadline with a durable per-game alarm. Your
only timing touchpoints:

- **`applyLifecycle` on `timeout`** — decide the consequence when a seat's clock
  runs out (see [The hooks](./hooks.md#applylifecycle)).
- **The envelope's `turn_seconds`** — override the deadline for *one* action
  only (e.g. a longer window for a special phase), without touching any player's
  bank. Omit it to use the game's configured timing.

:::note Bots imply a timed game

If a game seats a bot, it **must** be timed — the deadline is the backstop for a
bot that never moves. The engine enforces this at seating; your `botSeatable`
doesn't need to.

:::

For how the deadline is actually computed and enforced, see
[Timing & the deadline alarm](../concepts/timing.md).
