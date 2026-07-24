---
sidebar_position: 5
title: Transitions & animation
description: The `cause` argument, and how to embed animation cues a seat is permitted to see.
---

# Transitions & animation — the `cause`

Pure frame-diffing can't always recover *what happened* (identical footprints,
hidden moves, composite resolutions). So `computeObservation` receives a
`cause` — the action that produced the state being projected (`{ kind: "game",
data, playerIndex }`, a `lifecycle`, or `null` for the initial frame).

To let a client animate, embed whatever cues a seat is *permitted* to see into
that seat's `data` (e.g. a `lastMove` field, or RPS's `lastRound` reveal).
Because the embedding happens inside `computeObservation`, visibility stays
game-controlled. Cues describe a *transition*: a client renders them as animation
when it holds the predecessor frame, and as static "last move" info otherwise.

The client half of this — how frames become animations — is in
[The frame & animation model](../client/frames.md).
