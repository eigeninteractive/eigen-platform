---
sidebar_position: 3
title: The frame & animation model
description: Three guarantees that make "animate the change between frames" sound, and how optimistic preview stays game-owned.
---

# The frame & animation model

Animation is the presentation of **frame transitions**. Three guarantees:

1. **You see every frame, in order.** Every move — yours, an opponent's, a bot's,
   a timeout resolution — arrives as its own frame, so "animate the change between
   the previous frame and this one" is sound for *all* transitions. The one
   exception is a cold (re)load, where the stream starts at the latest frame with
   no predecessor (rule 3).
2. **The observation tells you what happened — don't diff frames.** Frame diffing
   can't recover causality (a hidden move with no visible footprint; two causes
   with the same footprint; a composite resolution the diff collapsed). Instead
   the game's `computeObservation` receives the transition's `cause` and embeds
   each seat's permitted view of it into that seat's `data` (a `lastMove` /
   `events` field, shaped for your animation). Visibility is per-seat because the
   embedding happens inside the projection, and replay frames carry the same cues
   — one animation pipeline serves live play and replay.
3. **Animate a cue only when you rendered its predecessor.** A cue describes a
   transition. On a cold load or stale rejoin you get a frame whose predecessor
   you never rendered — show the cue as static "last move" info (a highlight), not
   an animation. Keep the last rendered `version` in widget state; play the
   entrance animation only when the incoming frame is its direct successor.

The server half of this is [Transitions & animation](../build-a-game/transitions.md).

## Optimistic preview (optional latency hiding)

A turn-based round trip is usually well under a second, so latency hiding is
**game-owned** — the transport never predicts game state, it only reports how a
submit resolved. Two layers:

- **Outcome-independent feedback** needs no bookkeeping: lift the piece on tap,
  slide it, play the sound in local widget state, resolved when the server frame
  lands. `GameContentContext.actionPending` already marks the in-flight window.
- **Optimistic rendering** pairs the Dart twin's `previewAction` with the
  `ActionSubmitResult` that `onAction` returns. Compute the predicted observation
  locally and render it while the request is in flight; the result tells you what
  the stream will do:
  - **`committed`** — the confirming frame is guaranteed to be the *next* frame
    (versions are serial, so nothing commits in between); clear the prediction
    when it arrives.
  - **`rejected`** — the move did not commit and no frame is coming; revert (the
    board snaps back). Infra has already surfaced the error.
  - **`unconfirmed`** (the request failed in transit) — the server may or may not
    have committed it; revert, and if it *did* commit, its frame arrives over the
    socket and re-applies.

`previewAction` returning null means "don't predict this move" — required for
moves whose result depends on hidden information (a combat resolution, a reveal,
a deck draw); those render server-driven. Predict only the actor's own moves;
opponents' moves always arrive as server frames.
