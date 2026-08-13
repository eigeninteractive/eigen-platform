---
sidebar_position: 7
title: Bots
description: Writing an engine bot brain, a move function that ships inside your game module.
---

# Bots

A bot is a registry row (an operator inserts it) whose `type` decides how it
moves. The one you write in your game module is the **`engine`** bot: a brain
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
action, validated against `schemas.action` exactly like a human's (an illegal
bot move fails that seat's turn and the deadline backstops it; it can't corrupt
the game). The brain sees only its seat's observation, the same fog a human
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

## The client half

There is almost none, and that is the point: **client-side bots do not exist**.
Every bot is seated by the server, so a game screen renders a bot seat exactly
like a human one: same `PlayersContext` entry, same avatar (with a bot badge),
same frames arriving over the same socket. Do not branch on seat type to decide
whether to show identity.

The one member that participates is the Dart `botSeatable` twin, which filters
the bot picker locally with no network call. It is display-only; the server
enforces the same rule before seating.

The one constraint that reaches the creation UI is that **a game seating a bot
must be timed**, because bot dispatch is single-attempt, so the turn deadline is the
only thing that resolves a bot which never moves. See
[Creation UI](./creation-ui.md).

Registering the bot row is an operator task; see
[Registering bots](../ship-it/configure.md#registering-bots). For the
transport and HMAC details of external bots, see [Bots](../how-it-works/bots.md).
