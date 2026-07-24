---
sidebar_position: 12
title: Recipes — common game shapes
description: Sequential, simultaneous, team, elimination and phased games — all expressed through pending_players and computeObservation.
---

# Recipes — common game shapes

The whole game is expressed through `pending_players` and what
`computeObservation` reveals. A few canonical shapes:

## Sequential (perfect information)

Checkers, Connect Four. One seat pending at a time; each move hands the turn to
the next seat. Use `passthroughObservation` (everyone sees everything). The
same-view rule is automatically strict — no stale move survives an opponent's
turn.

```ts
applyAction({ state, playerIndex, data }) {
  const next = applyMove(state, playerIndex, data);
  return next.won
    ? { state: next, pending_players: [], outcome: win(playerIndex) }
    : { state: next, pending_players: [(playerIndex + 1) % playerCount] };
}
computeObservation: passthroughObservation,
```

## Simultaneous (hidden commitment)

RPS, blind bidding. *All* actors pending each round; store each commit in the
state and hide the opponents' commits in `computeObservation`, also masking their
pending status so a hidden commit doesn't change anyone else's view (that's what
lets both submissions land in either order — see
[the same-view rule](./hidden-information.md)). Resolve when the last commit
arrives.

## Team games

Set `team_index` on outcome entries to the team, not the seat, so OpenSkill rates
teammates together. `placement` is the team's finish.

## Elimination / multiplayer

Shrink `pending_players` as seats bust out; give an eliminated seat
`result: "eliminated"` with its `placement`. The game ends when
`pending_players` empties; the final `outcome` ranks everyone by placement.

## Reveal for animation

Carry a "what just happened" field (RPS's `lastRound`) in the projected `data` so
clients can animate the transition. Decide per seat what that reveal shows using
`cause` and `playerIndex` — see [Transitions & animation](./transitions.md).

## Phased turns / variable clocks

A phase that needs longer returns `turn_seconds: N` on its envelope to widen just
that action's deadline, leaving every player's bank untouched.
