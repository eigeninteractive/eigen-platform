---
sidebar_position: 3
title: The hooks, in detail
description: The six hooks every GameRules unit implements, and what the engine has already guaranteed before each one is called.
---

# The hooks, in detail

Everything returns an **`Envelope<State>`**: the new `state`, the
`pending_players` who may act next (empty ⇒ game over), an optional `outcome`
(present **only** when the game ends), and an optional `turn_seconds` override
for this one action. See the [Envelope reference](../reference/envelope.md).

## `initialState({ config, rng, playerCount }) → Envelope`

The starting position. Draw any setup randomness (shuffle, first player) from
`rng`. Set `pending_players` to whoever moves first.

## `applyAction({ state, pending, data, playerIndex, config, rng }) → Envelope`

A player's move. **The engine has already confirmed it is this seat's turn at the
expected version** — do not re-check turn order. Validate move *legality* only;
if it fails, `throw new IllegalMoveError("…")` and the engine renders it as the
caller's error. Any *other* throw is treated as a game bug (a server 500). Return
the next envelope: advance the state, set the next `pending_players`, and include
`outcome` if this move ended the game.

## `applyLifecycle({ state, pending, type, data, rng }) → Envelope` \{#applylifecycle}

Resolve an out-of-rules event. Unlike `applyAction` it can never be "illegal" —
it always resolves. Three triggers:

- **`timeout`** — the seats in `pending` ran out of time. Resolve the whole set
  in one envelope (you decide the consequence — often a loss for the idle seat,
  or a draw if everyone stalled).
- **`forfeit`** — a voluntary resign; the seat is in `data.player_index`.
- **`auto_forfeit`** — the engine-driven variant (an account was deleted). Same
  shape as forfeit; you *may* choose a gentler consequence (e.g. a draw rather
  than a loss) since the seat didn't choose to quit.

## `computeObservation({ state, pending, playerIndex, cause, isReplay, … }) → ObservationSlice`

Project the state into **one seat's view** — this is where hidden information
lives. Return `{ data, pending_players }`:

- `data` is exactly what this seat may see. Strip anything hidden (opponents'
  hands, face-down cards, un-revealed simultaneous commits).
- `pending_players` may be *narrowed* from the true set to avoid leaking
  information (e.g. hiding that an opponent has secretly moved) — but it must
  stay truthful about the seat *itself*, and the engine enforces that.
- `playerIndex` is `null` for a public viewer (only ever with `isReplay: true` —
  a finished public game), where you can reveal everything.
- `cause` tells the seat *what just happened* (see [Transitions & animation](./transitions.md)).
  `isReplay` is true only for finished-game replay, where hidden-info games may
  reveal opponent state.

For a **perfect-information game**, use the shipped `passthroughObservation`
helper — every seat sees the full state and the true pending set.

:::warning This hook silently sets your simultaneous-move policy

See [Hidden information & the same-view rule](./hidden-information.md).

:::

## `ratingPool({ access, turnSeconds, budgetSeconds, config, … }) → string | null`

Decide whether — and in which pool — a game with these settings is rated. Return
a pool name (`"standard"`, `"rapid"`, …) or `null` for unrated. The engine
computes `canBeRated = pool !== null && !guest` and validates the client's
concrete `rated` flag against it. (The Dart twin computes the same value so the
create dialog can gate the Rated/Casual toggle.)

## `botSeatable({ gameConfig, botConfig }) → boolean`

Whether a bot's declared capabilities support this game config. Return `true` to
allow the seating. See [Bots](./bots.md).
