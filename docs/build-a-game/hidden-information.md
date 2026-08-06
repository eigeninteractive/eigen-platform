---
sidebar_position: 4
title: Hidden information
description: Fog is one hook on the server; on the client it is two nullable fields and a decision not to predict. Plus the same-view rule that makes simultaneous moves correct with zero game code.
---

# Hidden information

Fog costs less than you expect, in both halves. On the server it is what you
*omit* from `computeObservation`. On the client it is a codec that accepts more
than one shape, and an honest answer to "can I predict what happens next?"

What it buys is more than secrecy: what you reveal also decides, silently,
which concurrent submissions the engine accepts.

## The same-view rule

Simultaneous moves are the classic source of turn-based race bugs. The engine
resolves them with a rule that needs **zero game code**, driven entirely by what
your
`computeObservation` reveals:

> A stale-version action (one computed against an older version) is accepted **if
> and only if** the acting seat's projected observation is byte-identical between
> the version it expected and the current version. Otherwise it is rejected with
> `board_updated` and the client resyncs.

Work through Rock–Paper–Scissors. Both players commit "simultaneously":

- Player 0 commits. The state changes and the version bumps — but because
  `computeObservation` **hides player 1's commit and masks player 1's pending
  status**, *player 1's projected view is unchanged*. So player 1's in-flight
  commit, computed against the older version, still lands. Order does not matter.
- When the *second* commit resolves the round, the reveal (`lastRound`, the new
  `wins`) changes *every* seat's view — so any submission still computed against
  the pre-resolution round is correctly rejected.

You never wrote a lock, a "both players ready" check, or a retry. You chose what
each seat sees, and the acceptance policy followed. A perfect-information game
using `passthroughObservation` gets the *strict* policy automatically: any
opponent move changes everyone's view, so no stale submission survives.

Two invariants to rely on: versions stay strictly serial (the rule governs
*acceptance*, never ordering — every accepted move is still the next version),
and a seat's projection must stay truthful about itself, which the engine
enforces.

## The client half

### The secret is not on the device

There is no client-side masking to write, because the hidden data never arrives.
`computeObservation` runs on the server; what it omits is absent from the bytes.
The only client-side consequence is that the observation shape can differ by
audience — RPS carries `yourMove` live and `commits` in replay — so the codec
accepts both. That is covered in
[Payload types](./schemas.md#modelling-the-observation).

### Masking pending changes what "my turn" means

`pendingPlayers` is projected too. In RPS a seat sees at most **its own** seat
in `frame.pendingPlayers`, never the opponent's. So:

- `pendingPlayers.contains(mySeat)` still answers "may I act?" correctly.
- Anything of the form "is the opponent still thinking?" is **unanswerable**, and
  a UI that implies otherwise is lying. Render "waiting" rather than "opponent is
  choosing".

### When you cannot predict, say so

`previewAction` is the game's optimistic projection of its own next observation,
and returning `null` means "this move is server-driven". Null is always a correct
answer — never drift, never a gap in the implementation.

RPS returns null unconditionally, and the reason is exactly the masking above.
After you throw, you cannot tell which of two futures you are in: the opponent
has not thrown yet, so your next frame just echoes `yourMove`; or they threw
first, so your throw resolves the round and your next frame is a full reveal with
a new score. Predicting either is wrong half the time, and a prediction that is
wrong half the time is worse than none — it shows a reveal that never happened.

```dart
/// Always null — RPS cannot predict its own next observation, and saying so
/// is the correct answer rather than a gap.
@override
RpsV1Observation? previewAction({ /* … */ }) => null;
```

The board still feels instant. It holds the tapped move in widget state and
resolves it against the `ActionSubmitResult` the submit returns — optimism about
*your own action*, which you can always know, rather than about *the resulting
position*, which here you cannot. See
[Rendering](./rendering.md#optimistic-preview).

That distinction is worth carrying into your own game:

| You can always know | You can only sometimes predict |
|---|---|
| what you just tapped | what the position becomes |
| that a submit is in flight | whether an opponent has acted |
| whether the server accepted it | anything behind fog |

A game whose every move resolves against hidden information implements
`previewAction` as `=> null` and loses nothing.

## Where to look next

[The RPS walkthrough](../getting-started/your-first-game.md) is the code this
page describes, in both languages.
