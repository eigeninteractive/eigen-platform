---
sidebar_position: 5
title: Rendering the game
description: buildContent and everything it receives, the frame model that makes animation sound, and how to hide latency without lying, plus the server-side cues that feed it.
---

# Rendering the game

`buildContent` is the one widget a game must supply. Everything around it
(sign-in, home, lobby, the countdown, the finished banner, replay controls) is
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
| `transition` | The step into `frame` (`from`, `to`), or **null when there is nothing to animate**. |
| `gameStatus`, `outcomes` | Lifecycle status; per-seat results (empty until finished). |
| `actionPending` | True while a submit awaits its confirming frame; disable input on it. |
| `onAction(json)` | Submits a move; returns `Future<ActionSubmitResult>`. Never throws, because the engine has already surfaced any error. |
| `onInvalidAction()` | Call when `isValidAction` rejects a tap. **The engine owns the haptic**, so never import `flutter/services.dart` to pick one yourself. |
| `playersContext` | Resolved identities, keyed by seat; `mySeat` delegates to it. |
| `isReplay` | True when stepping a finished game frame by frame. |

Identity is resolved **before** the screen renders, so `playersContext[seat]` is
non-nullable: no loading states, no null checks. A participant whose account was
deleted arrives as a synthetic identity with `isDeleted` set; guard on that flag,
never on the synthetic id.

During replay `gameStatus` is `finished` for every frame and `outcomes` is
populated only on the final one, so a win banner appears at the end rather than
part-way through. A game never *needs* `isReplay` to stay correct, since the
frame is a real observation and `onAction` is inert. It exists for replay-only
presentation.

## The frame model

Animation is the presentation of **frame transitions**, and three guarantees make
that sound:

1. **You see every frame, in order.** Every move (yours, an opponent's, a bot's,
   a timeout resolution) arrives as its own frame, so "animate the change
   between the previous frame and this one" holds for *all* transitions. The one
   exception is a cold load, where the stream starts at the latest frame with no
   predecessor.
2. **The observation tells you what happened, so do not diff frames.** Diffing
   cannot recover causality: a hidden move leaves no visible footprint, two
   different causes can leave the same one, and a composite resolution collapses
   into a single diff.
3. **Animate only when `transition` is non-null.** It is the step into the
   current frame, and it is null exactly when animating would be wrong: a cold
   load, a stale rejoin, or the opening frame, where the cue is history rather
   than an event. Show it statically then. You do not have to track the last
   rendered version yourself; the engine already knows whether the player saw the
   predecessor.

```dart
if (ctx.transition case final step?) {
  // The player watched this happen: animate from step.from to step.to.
} else {
  // Nothing to animate from. Render ctx.frame as the current position.
}
```

**Correctness never depends on animating.** The newest frame is always
sufficient on its own, so skipping intermediate frames is never wrong, only less
pretty. That matters in practice: a bot can commit faster than a 600ms deal
animation, the turn clock does not stop while a card is in flight, and a slow
device falls behind. Treat your animations as interruptible and jump to the end
state when a newer frame lands.

### Several beats in one frame

One version can hold more than one visual event: a round resolving may reveal
both commits, score them, and deal again. The frame is the atomic unit of
*truth*, but it is the **script** for several animation steps, so embed an
ordered `events` list in the observation and sequence it locally.

The rule that keeps this honest: **the list is presentation order, never a second
source of state.** The position after the last beat must equal what the rest of
the observation already says, so a client that skips the animation entirely is
still correct.

### The server side of a cue

Because diffing cannot recover causality, `computeObservation` receives a
**`cause`**: the action that produced the state being projected
(`{ kind: "game", data, playerIndex }`, a lifecycle event, or `null` for the
opening frame).

Embed whatever cues a seat is *permitted* to see into that seat's `data`: a
`lastMove` field, an `events` list, RPS's `lastRound` reveal. Because the
embedding happens inside the projection, **visibility stays game-controlled**,
and replay frames carry the same cues, so one animation pipeline serves live play
and replay.

## Optimistic preview

A turn-based round trip is usually well under a second, so latency hiding is
**game-owned**: the transport never predicts game state, it only reports how a
submit resolved. Two layers, and most games want only the first.

### Feedback that does not depend on the outcome

Needs no bookkeeping at all. Lift the piece on tap, slide it, play the sound,
show the throw you chose, all in local widget state, resolved when the server
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
| `committed` | The confirming frame is the **next** frame this seat receives; versions are serial, so nothing commits in between. | Clear the prediction when it arrives. |
| `rejected` | The move did not commit and **no frame is coming**. | Revert. The engine has already surfaced the error. |
| `unconfirmed` | The request failed in transit; the server may or may not have committed it. | Revert. If it did commit, its frame arrives over the socket and re-applies. |

Predict only the actor's own moves; opponents' moves always arrive as server
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

Show identity uniformly for humans and bots, and do not branch on player type to
decide whether to render a name. Use the seat's `type` only where the game's own
rules must distinguish a bot seat. Per-game roles (host, team, dealer) are not an
engine concept at all: they live in your observation JSON.

## Testing the screen

`buildContent` receives a plain value object, so testing it needs no server, no
socket and no auth, just a `GameContentContext` built by hand. The RPS example's
`test/board_test.dart` is the worked version; the harness is about thirty lines
and is the piece worth copying.

The one framework wiring a widget test needs is a `ProviderScope` carrying an
`AppConfig`, because shared widgets like `PlayerAvatar` resolve avatar URLs
against the configured API host.
