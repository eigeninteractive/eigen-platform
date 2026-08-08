---
sidebar_position: 3
title: Your first game
description: Rock–Paper–Scissors in both languages. The rules that decide, the screen that draws, and the fixture file that keeps them agreeing.
---

# Your first game

Rock–Paper–Scissors is the reference implementation, and it is deliberately the
*hardest* small case: both players commit at the same time, and neither may see
the other's throw. Simultaneous turns, hidden information, and, as it turns out,
nothing worth predicting.

This page is the whole game, both halves. Roughly 500 lines of Dart and 220 of
TypeScript, and none of it mentions turns, deadlines, sockets, versions,
persistence, ratings, sign-in, lobbies or replay.

## The rules that decide

`eigen-server/examples/rps/src/module/v1.ts`, condensed:

```ts
class RpsRulesV1 implements GameRules<State, Observation, Action, Config> {
  readonly schemas = {
    state: stateSchema,
    observation: observationSchema,
    action: actionSchema,
    config: configSchema,
  };

  initialState(): Envelope<State> {
    return { state: { round: 1, wins: [0, 0], commits: [null, null], lastRound: null },
             pendingPlayers: [0, 1] };   // both seats act at once
  }

  applyAction({ state, data, playerIndex, config }: ApplyActionArgs<State, Action, Config>): Envelope<State> {
    const seat = playerIndex as 0 | 1;
    const other = (1 - seat) as 0 | 1;
    const otherMove = state.commits[other];

    if (otherMove === null) {
      // First commit of the round: record it, wait for the opponent.
      const commits: State["commits"] = [null, null];
      commits[seat] = data.move;
      return { state: { ...state, commits }, pendingPlayers: [other] };
    }

    // Second commit: resolve the round, and maybe the match.
    const moves = seat === 0 ? [data.move, otherMove] : [otherMove, data.move];
    const winner = beats(moves[0], moves[1]) ? 0 : beats(moves[1], moves[0]) ? 1 : null;
    const wins = [...state.wins]; if (winner !== null) wins[winner] += 1;

    if (winner !== null && wins[winner] >= config.targetWins) {
      return { state: { ...state, wins, commits: [null, null], lastRound: { moves, winner } },
               pendingPlayers: [], outcome: matchOutcome(winner) };
    }
    return { state: { round: state.round + 1, wins, commits: [null, null], lastRound: { moves, winner } },
             pendingPlayers: [0, 1] };
  }

  computeObservation({ state, pending, playerIndex, isReplay }: ComputeObservationArgs<…>): ObservationSlice {
    if (isReplay || playerIndex === null) {
      // The match is over, so reveal everything.
      return { data: { round: state.round, wins: state.wins, lastRound: state.lastRound, commits: state.commits },
               pendingPlayers: pending };
    }
    const seat = playerIndex as 0 | 1;
    // Two deliberate omissions that ARE the game:
    //  - the opponent's commit is hidden (only your own move comes back);
    //  - the opponent's pending status is masked (you see only your own).
    return { data: { round: state.round, wins: state.wins, lastRound: state.lastRound, yourMove: state.commits[seat] },
             pendingPlayers: pending.filter((s) => s === seat) };
  }

  ratingPool({ access }: RatingPoolArgs<Config>): string | null {
    return access === "public" ? "standard" : null;
  }
  botSeatable(): boolean { return true; }
}
```

Everything that makes RPS *RPS* is in `computeObservation`, and it is entirely
about what it leaves out.

## The screen that draws

`eigen-flutter/example/lib/src/v1/rules.dart` is the same version in the other
language:

```dart
class RpsRulesV1 extends RpsV1RulesBase {
  const RpsRulesV1();

  // The legality half of applyAction, transcribed. This is what greys out a button.
  @override
  bool isValidAction({
    required RpsV1Observation obs,
    required List<int> pending,
    required RpsV1Action data,
    required int playerIndex,
    required RpsV1Config config,
  }) => pending.contains(playerIndex) && !obs.committedBy(playerIndex);

  // Always null. See below; this is the interesting one.
  @override
  RpsV1Observation? previewAction({ /* same parameters */ }) => null;

  @override
  Widget buildContent(GameContentContext context) =>
      RpsBoard(context: context, rules: this);

  @override
  String? ratingPool(RatingPoolArgs args) =>
      args.access == GameAccess.public ? 'standard' : null;

  @override
  bool botSeatable(BotSeatableArgs args) => true;
}
```

The board itself is a `StatefulWidget` reading `context.frame.observation`,
drawing three buttons, and calling `context.onAction(...)`. Everything around it
(sign-in, home, the lobby, the countdown, the finished banner, replay) is the
shell's.

## Three things worth taking away

### The observation is not the state

The server stores `commits: [move, move]`. The client never sees that field
during play; it sees `yourMove`, its own commit echoed back. The opponent's
throw is not hidden by the UI; **it is not in the bytes that reach the device**.

The cost of that on the client is one nullable field, because
`computeObservation` emits a second shape for replay. That is the entire cost.

### Hiding *pending* is what makes simultaneous play correct

`pendingPlayers: pending.filter((s) => s === seat)` looks like a detail. It is
the mechanism.

Because a hidden commit does not change your projected view, the engine's
same-view rule accepts your in-flight submission even though it was computed
against an older version, so both players can commit in either order and both
land. When the *second* commit resolves the round, the reveal changes every
seat's view, so a stale submission is correctly rejected.

No lock, no "both players ready" check, no retry. You chose what each seat sees,
and the concurrency policy followed. See
[Hidden information](../build-a-game/hidden-information.md).

### Sometimes the honest answer is "I cannot predict this"

`previewAction` returns null, unconditionally. After you throw, you cannot tell
whether the opponent has thrown yet, which is exactly what the masking above
hides, so you cannot tell whether your next frame is a quiet echo or a full
reveal with a new score. Predicting either would be wrong half the time.

The board still feels instant: it holds the tapped move in widget state and
resolves it against the `ActionSubmitResult` the submit returns. That is optimism
about *your own action*, which you can always know, rather than about *the
resulting position*, which here you cannot.

## The file that keeps them agreeing

Both repos carry a byte-identical `fixtures/v1/rps.json`, and both run it:

```json
{
  "kind": "action",
  "name": "first commit of a round is recorded and hidden",
  "config": { "targetWins": 1 },
  "state":  { "round": 1, "wins": [0,0], "commits": [null,null], "lastRound": null },
  "obs":    { "round": 1, "wins": [0,0], "lastRound": null, "yourMove": null },
  "pending": [0, 1],
  "playerIndex": 0,
  "action": { "move": "rock" },
  "expected": {
    "valid": true,
    "state": { "round": 1, "wins": [0,0], "commits": ["rock",null], "lastRound": null },
    "pending": [1],
    "outcome": null,
    "observation": { "round": 1, "wins": [0,0], "lastRound": null, "yourMove": "rock" }
  }
}
```

The TypeScript runner drives `applyAction` and `computeObservation` with `state`;
the Dart runner drives the codec and `isValidAction` with **`obs`**, the acting
seat's actual view, which for a game with fog is a different payload. A
divergence fails a test in whichever language drifted.

See [Testing](../build-a-game/testing.md) for the full format and the
contract/generator checks that carry the authored server fixtures into the app.

## Next

Read [The contract](../build-a-game/the-contract.md) for what you write and what
the engine owns, then work down the *Build a game* section in order.
