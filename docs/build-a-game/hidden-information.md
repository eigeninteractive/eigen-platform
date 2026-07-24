---
sidebar_position: 4
title: Hidden information & the same-view rule
description: How simultaneous moves resolve correctly with zero game code, driven entirely by what computeObservation reveals.
---

# Hidden information & the same-view rule

Simultaneous moves are the classic source of turn-based race bugs. Eigen resolves
them with a rule that needs **zero game code**, driven entirely by what your
`computeObservation` reveals:

> A stale-version action (one computed against an older version) is accepted **if
> and only if** the acting seat's projected observation is byte-identical between
> the version it expected and the current version. Otherwise it's rejected with
> `board_updated` and the client resyncs.

Work through Rock-Paper-Scissors. Both players commit "simultaneously":

- Player 0 commits. The state changes (version bumps), but because
  `computeObservation` **hides player 1's commit and masks player 1's pending
  status**, *player 1's projected view is unchanged*. So player 1's in-flight
  commit — computed against the older version — still lands. Order doesn't
  matter.
- When the *second* commit resolves the round, the reveal (`lastRound`, the new
  `wins`) changes *every* seat's view — so any submission still computed against
  the pre-resolution round is correctly rejected.

You never wrote a lock, a "both players ready" check, or a retry. You chose what
each seat sees, and the acceptance policy followed. A perfect-information game
using `passthroughObservation` gets the *strict* policy automatically: any
opponent move changes everyone's view, so no stale submission survives.

Two invariants to rely on: versions stay strictly serial (the rule governs
*acceptance*, never ordering — every accepted move is still the next version),
and a seat's projection must stay truthful about itself (the engine enforces it).

See [The full RPS walkthrough](../getting-started/your-first-game.md) for the
code this describes.
