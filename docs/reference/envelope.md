---
sidebar_position: 3
title: The Envelope, determinism & errors
description: The return shape of every hook, the RNG contract, and what to throw.
---

# The Envelope, determinism, and errors

## The Envelope

Every hook returns `Envelope<State>`:

| Field | Meaning |
|---|---|
| `state` | The new pure game payload — validated against your `state` schema before commit. Never carries whose-turn or winner metadata. |
| `pending_players` | 0-based seats that may act next. **Empty ⇒ the game is over** (with `outcome`). |
| `outcome?` | Present **only** on the ending transition: one `OutcomeEntry` per seat (`result`, `placement`, `team_index`, optional `score`). |
| `turn_seconds?` | Override the deadline for *this action only*; omit for the game's configured timing. |

The generated types are in the [`@eigeninteractive/rules` reference](./typescript/rules.md).

## Determinism — the RNG contract

State must be a pure function of `(base seed, ordered action log)`. The engine
gives each transition a seeded `rng` (`rng.next()` → `[0, 1)`), derived from the
game's stored seed and the committing version, so replaying a transition
reproduces the identical sequence. The rules:

- **Draw only from `args.rng`** — never `Math.random()`, `Date.now()`,
  `crypto`, or any external read inside a hook.
- **Draw in deterministic code order** — the same number of draws in the same
  order every time, so a replay lines up.
- **Bot brains may be impure** — a bot's `rng` is deterministic too, but the
  *chosen move* is what gets logged; replay reads the recorded action and never
  re-runs the brain, so a brain that peeks at the clock only affects live play.

## Errors — what to throw

- `throw new IllegalMoveError("…")` from `applyAction` for a move that breaks the
  rules (a mis-tap, a buggy client). The engine renders it as the **caller's**
  error (a 400 `illegal_move`) — this is an *expected* outcome, not a fault.
- **Any other throw** from a hook is treated as a **game bug** and surfaces as a
  server 500. Don't use exceptions for control flow; return the right envelope
  instead.
- You never validate turn order, versions, seat ownership, or timing — the engine
  has already enforced all of it before your hook runs. Validate only move
  *legality*.

For the HTTP-level error model, see
[The HTTP surface](./http-surface.md#the-error-model).
