---
sidebar_position: 3
title: The kernel
description: The pure decision core — a function from inputs to a commit plan, with no I/O and no platform APIs.
---

# The kernel — the pure decision core

`@eigeninteractive/kernel` is the crown jewel: a pure function from inputs to a commit
plan. It touches no platform API, so it is exhaustively unit-testable and
identical in every environment.

```text
commit({ game, state, roster, intent, now, rules, staleViews }) →
    CommitPlan  |  Rejected
```

- **`intent`** is one of `start` (seed a new game), `action` (a player/bot
  move), or `lifecycle` (`timeout` / `forfeit` / `auto_forfeit`).
- **`rules`** is the game's `GameRules` unit for this game's `schema_version`.
  The kernel invokes the game's hooks but owns everything around them.
- A **`CommitPlan`** carries: the next `StateRow` (version, opaque state,
  pending set, deadline, per-player clocks), the per-seat projected
  `frames`, the `action` to log, any `outcomes` (if the game ended), the
  `alarm` time to arm, and named **effects** (`wake_bot`, `notify_turn`,
  `notify_finished`) for the runtime to deliver post-commit.
- A **`Rejected`** is a value, not an exception: a stable `code`
  (`illegal_move`, `not_participant`, `board_updated`, …) plus a message. The
  DO returns it; the Worker maps it to an HTTP status.

The kernel owns four things worth calling out:

- **Timing & grace** — computing the next deadline, the per-player time bank,
  and whether a late submission is still inside the grace window. See
  [Timing & the deadline alarm](./timing.md).
- **The same-view rule** — whether a stale-version action is still valid. See
  [The game lifecycle](./lifecycle.md).
- **Observation fan-out** — calling `computeObservation` once per seat to build
  the frames, and enforcing that a seat's projection stays truthful about
  itself.
- **Rating math** — OpenSkill posteriors, given priors and placements. (The
  *application* of ratings — reading priors, the CAS write — is in the DO/D1
  layer; see [Data & storage](./storage.md). Only the math is here.)

:::note Version dispatch never happens inside game logic

The engine resolves the game's `schema_version` to a `GameRules` unit once, up
front, and every hook it calls is already the right version. A game author
never writes `if (version === …)`. See [Evolving your game](../build-a-game/versions.md).

:::

The kernel's full API is in the [`@eigeninteractive/kernel` reference](../reference/typescript/kernel.md).
