---
sidebar_position: 11
title: Recipes — common game shapes
description: Sequential, simultaneous, team, elimination and phased games — all expressed through pendingPlayers and computeObservation.
---

# Recipes — common game shapes

The whole game is expressed through `pendingPlayers` and what
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
    ? { state: next, pendingPlayers: [], outcome: win(playerIndex) }
    : { state: next, pendingPlayers: [(playerIndex + 1) % playerCount] };
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

Set `teamIndex` on outcome entries to the team, not the seat, so OpenSkill rates
teammates together. `placement` is the team's finish.

## Elimination / multiplayer

Shrink `pendingPlayers` as seats bust out; give an eliminated seat
`result: "eliminated"` with its `placement`. The game ends when
`pendingPlayers` empties; the final `outcome` ranks everyone by placement.

## Reveal for animation

Carry a "what just happened" field (RPS's `lastRound`) in the projected `data` so
clients can animate the transition. Decide per seat what that reveal shows using
`cause` and `playerIndex` — see [Rendering](./rendering.md).

## Phased turns / variable clocks

A phase that needs longer returns `turnSeconds: N` on its envelope to widen just
that action's deadline, leaving every player's bank untouched.
