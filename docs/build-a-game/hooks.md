---
sidebar_position: 3
title: The hooks
description: The six server hooks, what the engine has already guaranteed before each is called, and what each one produces on the client.
---

# The hooks

The six hooks are the deciding half of a game, and they all live in TypeScript.
Each section below ends with **what reaches the client** — because a hook's real
output is not its return value, it is what a player ends up looking at.

Everything returns an **`Envelope<State>`**: the new `state`, the
`pending_players` who may act next (empty ⇒ game over), an optional `outcome`
(present **only** when the game ends), and an optional `turn_seconds` override
for this one action. See the [Envelope reference](../reference/envelope.md).

## `initialState({ config, rng, playerCount }) → Envelope`

The starting position. Draw any setup randomness (shuffle, first player) from
`rng`. Set `pending_players` to whoever moves first.

*On the client:* the first frame of the game, projected through
`computeObservation` with `cause: null`. There is no predecessor, so a game
should render it as a static opening position rather than animating into it.

## `applyAction({ state, pending, data, playerIndex, config, rng }) → Envelope`

A player's move. **The engine has already confirmed it is this seat's turn at the
expected version** — do not re-check turn order. Validate move *legality* only;
if it fails, `throw new IllegalMoveError("…")` and the engine renders it as the
caller's error. Any *other* throw is treated as a game bug (a server 500). Return
the next envelope: advance the state, set the next `pending_players`, and include
`outcome` if this move ended the game.

*On the client:* the legality check you write here is transcribed into the Dart
`isValidAction`, which greys out the illegal tap before it is ever sent. The two
are compared by [twin fixtures](./testing.md). The acting seat also gets an
`ActionSubmitResult` telling it whether a confirming frame is coming — see
[Rendering](./rendering.md).

## `applyLifecycle({ state, pending, type, data, rng }) → Envelope` \{#applylifecycle}

Resolve an out-of-rules event. Unlike `applyAction` it can never be "illegal" —
it always resolves. Three triggers:

- **`timeout`** — the seats in `pending` ran out of time. Resolve the whole set
  in one envelope (you decide the consequence — often a loss for the idle seat,
  or a draw if everyone stalled).
- **`forfeit`** — a voluntary resign; the seat is in `data.player_index`.
- **`auto_forfeit`** — the engine-driven variant (an account was deleted). Same
  shape as forfeit; you *may* choose a gentler consequence (a draw rather than a
  loss) since the seat did not choose to quit.

*On the client:* an ordinary frame, arriving unprompted. Nothing in the game
screen needs to know it came from a lifecycle event — `gameStatus` flips to
`finished` and `outcomes` populates like any other ending.

## `computeObservation({ state, pending, playerIndex, cause, isReplay, … }) → ObservationSlice`

Project the state into **one seat's view** — this is where hidden information
lives, and it is the hook with the most leverage in the whole contract. Return
`{ data, pending_players }`:

- `data` is exactly what this seat may see. Strip anything hidden (opponents'
  hands, face-down cards, un-revealed simultaneous commits).
- `pending_players` may be *narrowed* from the true set to avoid leaking
  information — for example hiding that an opponent has secretly moved — but it
  must stay truthful about the seat *itself*, and the engine enforces that.
- `playerIndex` is `null` for a public viewer (only ever with `isReplay: true`,
  a finished public game), where you can reveal everything.
- `cause` tells the seat *what just happened*; `isReplay` is true only for
  finished-game replay.

For a **perfect-information game**, use the shipped `passthroughObservation`
helper — every seat sees the full state and the true pending set.

*On the client:* this hook's return value is the only game data that exists.
`parseObservation` consumes it, `buildContent` draws it, and anything you did not
project simply is not on the device. Note that the shape may differ between live
play and replay — see [Payload types](./schemas.md#modelling-the-observation).

:::warning This hook silently sets your simultaneous-move policy

What you reveal here decides which concurrent submissions the engine accepts. See
[Hidden information](./hidden-information.md).

:::

## `ratingPool({ access, turnSeconds, budgetSeconds, config, … }) → string | null`

Decide whether — and in which pool — a game with these settings is rated. Return
a pool name (`"standard"`, `"rapid"`, …) or `null` for unrated. The engine
computes `canBeRated = pool !== null && !guest` and validates the client's
concrete `rated` flag against it.

*On the client:* the Dart twin of this function decides whether the create
dialog shows a Rated toggle at all. It is display-only — but the client sends a
concrete `rated` value and **the server rejects a mismatch with a 422** rather
than coercing, so a drifted twin is a visible bug, not a silent one. See
[Creation UI](./creation-ui.md).

## `botSeatable({ gameConfig, botConfig }) → boolean`

Whether a bot's declared capabilities support this game config. Return `true` to
allow the seating.

*On the client:* the Dart twin filters the bot picker locally, with no network
call. Also display-only; the server enforces the same rule before seating. See
[Bots](./bots.md).
