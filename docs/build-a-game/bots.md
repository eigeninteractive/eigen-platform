---
sidebar_position: 7
title: Bots
description: Writing an engine bot brain — a move function that ships inside your game module.
---

# Bots

A bot is a registry row (an operator inserts it) whose `type` decides how it
moves. The one you write in your game module is the **`engine`** bot — a brain
that runs *inside* the engine, no external service:

```ts
readonly botActions: Record<string, BotAction<Action, Config>> = {
  // keyed by the bot's registry `username`
  "rps-random": ({ rng }) => {
    const moves: Move[] = ["rock", "paper", "scissors"];
    return { move: moves[Math.floor(rng.next() * moves.length)] };
  },
};
```

When a seated engine bot is due, the engine resolves its row → `username` → this
function, runs it post-commit, and self-applies the returned move as that seat's
action — validated against `schemas.action` exactly like a human's (an illegal
bot move fails that seat's turn and the deadline backstops it; it can't corrupt
the game). The brain sees only its seat's observation — the same fog a human
gets, so a bot can't read hidden state.

Notes:

- **Several bots, one brain.** Personalities that share behaviour point their
  usernames at the same function and differ by their per-row `botConfig`
  (difficulty, style). Distinct behaviour is a distinct entry.
- **`rng` is deterministic** per (game, version, seat) for reproducible tests,
  but replay uses the *recorded* move, so the brain needn't be pure.
- **External and local bots** are engine concepts, not things you code in the
  game module: `external` bots are hosted elsewhere and woken over a signed
  webhook; `local` bots are reserved for future offline play. You only write
  `engine` brains here.

Registering the bot row is an operator task — see
[Registering bots](../operate/configuration.md#registering-bots). For the
transport and HMAC details of external bots, see [Bots (concepts)](../concepts/bots.md).
