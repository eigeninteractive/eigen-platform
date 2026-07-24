---
sidebar_position: 5
title: Rendering the game
description: buildContent and everything it receives, the frame model that makes animation sound, and how to hide latency without lying — plus the server-side cues that feed it.
---

# Rendering the game

`buildContent` is the one widget a game must supply. Everything around it —
sign-in, home, lobby, the countdown, the finished banner, replay controls — is
the shell's. This page covers what it receives, how frames become animation, and
how to hide a round trip honestly.

```dart
@override
Widget buildContent(GameContentContext context) =>
    RpsBoard(context: context, rules: this);
```

The engine hands widgets no rules access of their own. Pass `this` (or just the
members a widget needs) into the content widget you build, so the dependency
stays explicit.

## `GameContentContext`

One object rather than a long parameter list, so adding engine data later never
breaks every game's signature. All JSON parsing is already done.

| Member | Meaning |
|---|---|
| `config` | The parsed config, immutable for the whole game. Cast to your type. |
| `frame` | The per-event snapshot: `observation`, `pendingPlayers`, `version`, `timing`. |
| `gameStatus`, `outcomes` | Lifecycle status; per-seat results (empty until finished). |
| `actionPending` | True while a submit awaits its confirming frame — disable input on it. |
| `onAction(json)` | Submits a move; returns `Future<ActionSubmitResult>`. Never throws — the engine has already surfaced any error. |
| `onInvalidAction()` | Call when `isValidAction` rejects a tap. **The engine owns the haptic** — never import `flutter/services.dart` to pick one yourself. |
| `playersContext` | Resolved identities, keyed by seat; `mySeat` delegates to it. |
| `isReplay` | True when stepping a finished game frame by frame. |

Identity is resolved **before** the screen renders, so `playersContext[seat]` is
non-nullable — no loading states, no null checks. A participant whose account was
deleted arrives as a synthetic identity with `isDeleted` set; guard on that flag,
never on the synthetic id.

During replay `gameStatus` is `finished` for every frame and `outcomes` is
populated only on the final one, so a win banner appears at the end rather than
part-way through. A game never *needs* `isReplay` to stay correct — the frame is
a real observation and `onAction` is inert — it exists for replay-only
presentation.

## The frame model

Animation is the presentation of **frame transitions**, and three guarantees make
that sound:

1. **You see every frame, in order.** Every move — yours, an opponent's, a bot's,
   a timeout resolution — arrives as its own frame, so "animate the change
   between the previous frame and this one" holds for *all* transitions. The one
   exception is a cold load, where the stream starts at the latest frame with no
   predecessor.
2. **The observation tells you what happened — do not diff frames.** Diffing
   cannot recover causality: a hidden move leaves no visible footprint, two
   different causes can leave the same one, and a composite resolution collapses
   into a single diff.
3. **Animate a cue only when you rendered its predecessor.** On a cold load or a
   stale rejoin you get a frame whose predecessor you never drew — show the cue as
   static "last move" information, not an animation. Keep the last rendered
   `version` in widget state and play the entrance animation only when the
   incoming frame is its direct successor.

### The server side of a cue

Because diffing cannot recover causality, `computeObservation` receives a
**`cause`** — the action that produced the state being projected
(`{ kind: "game", data, playerIndex }`, a lifecycle event, or `null` for the
opening frame).

Embed whatever cues a seat is *permitted* to see into that seat's `data`: a
`lastMove` field, an `events` list, RPS's `lastRound` reveal. Because the
embedding happens inside the projection, **visibility stays game-controlled**,
and replay frames carry the same cues — one animation pipeline serves live play
and replay.

## Optimistic preview

A turn-based round trip is usually well under a second, so latency hiding is
**game-owned**: the transport never predicts game state, it only reports how a
submit resolved. Two layers, and most games want only the first.

### Feedback that does not depend on the outcome

Needs no bookkeeping at all. Lift the piece on tap, slide it, play the sound,
show the throw you chose — all in local widget state, resolved when the server
frame lands. `actionPending` already marks the in-flight window.

This is what RPS does, because it is all RPS *can* do:

```dart
setState(() => _submitting = move);
final result = await ctx.onAction(action.toJson());
if (!mounted) return;
// `committed` needs no handling: the confirming frame is guaranteed to be the
// next one, and didUpdateWidget clears the guess when it lands.
if (result != ActionSubmitResult.committed) {
  setState(() => _submitting = null);
}
```

### Predicting the resulting position

Pairs the Dart twin's `previewAction` with the `ActionSubmitResult` that
`onAction` returns. Compute the predicted observation locally, render it while
the request is in flight, and let the result tell you what the stream will do:

| Result | What it guarantees | What to do |
|---|---|---|
| `committed` | The confirming frame is the **next** frame this seat receives — versions are serial, so nothing commits in between. | Clear the prediction when it arrives. |
| `rejected` | The move did not commit and **no frame is coming**. | Revert. The engine has already surfaced the error. |
| `unconfirmed` | The request failed in transit; the server may or may not have committed it. | Revert. If it did commit, its frame arrives over the socket and re-applies. |

Predict only the actor's own moves — opponents' moves always arrive as server
frames. And `previewAction` returning null is always correct: see
[Hidden information](./hidden-information.md#when-you-cannot-predict-say-so) for
why RPS returns null unconditionally.

## Rendering seats

Route every avatar through `PlayerAvatar` rather than building one yourself.
Avatar URLs may be relative to the API host, and that resolution lives in one
place; the widget also carries the bot badge and the deleted-account fallback.

```dart
PlayerAvatar(
  avatarUrl: player.info.avatarUrl,
  isBot: player.type == SeatTypeEnum.bot,
  showBorder: isMe,
)
```

Show identity uniformly for humans and bots — do not branch on player type to
decide whether to render a name. Use the seat's `type` only where the game's own
rules must distinguish a bot seat. Per-game roles (host, team, dealer) are not an
engine concept at all: they live in your observation JSON.

## Testing the screen

`buildContent` receives a plain value object, so testing it needs no server, no
socket and no auth — just a `GameContentContext` built by hand. The RPS example's
`test/board_test.dart` is the worked version; the harness is about thirty lines
and is the piece worth copying.

The one framework wiring a widget test needs is a `ProviderScope` carrying an
`AppConfig`, because shared widgets like `PlayerAvatar` resolve avatar URLs
against the configured API host.
