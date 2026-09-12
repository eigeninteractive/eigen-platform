---
sidebar_position: 8
title: Offline play
description: Ship a Dart twin of your four authoritative hooks and a device can play your game against on-device bots with no network, then sync it in as an ordinary game.
---

# Offline play

A **local game** is private, unrated, untimed, one human seat plus bots only,
played entirely on the device with no network. It is created with a
client-generated id and synchronized to the server lazily, in the background,
as an ordinary game whose `origin` is `local` rather than `online`. Once
imported it behaves exactly like any other game: it shows up in history, it
replays, and it can never be rated.

This is opt-in, per `schemaVersion`. A version that ships no Dart local unit
simply offers no on-device bots for that version; nothing else about the game
changes. There is nothing to write on the TypeScript side — those hooks are
already authoritative, and import runs them unchanged.

## Opt in: the local unit

Return a `LocalGameRules` implementation from your version unit's
`GameRules.local` getter, which is `null` by default:

```dart
class RpsRulesV1 extends RpsV1RulesBase {
  const RpsRulesV1();

  // ...isValidAction, previewAction, buildContent, ratingPool, botSeatable...

  @override
  LocalGameRules<Object?, RpsV1Observation, RpsV1Action, RpsV1Config>? get local =>
      const RpsLocalRulesV1();
}
```

`eigen_codegen` emits `RpsV1LocalRulesBase` alongside `RpsV1RulesBase`, from
the same contract. It already implements the seven payload codecs the local
kernel needs (`parseState`/`serializeState`, plus the config/action/observation
pair the wire base also has), so your subclass supplies only game behavior:
the same four hooks that are authoritative in TypeScript, transcribed
parameter for parameter, plus `botActions`. Compare this to
`server/examples/rps/src/module/v1.ts`, which it transcribes line for line,
down to its two small helpers:

```dart
bool _beats(RpsV1Move a, RpsV1Move b) =>
    (a == RpsV1Move.rock && b == RpsV1Move.scissors) ||
    (a == RpsV1Move.scissors && b == RpsV1Move.paper) ||
    (a == RpsV1Move.paper && b == RpsV1Move.rock);

List<Outcome> _matchOutcome(int winner) => [
  Outcome(playerIndex: winner, result: OutcomeResultEnum.win, placement: 1, teamIndex: winner),
  Outcome(playerIndex: 1 - winner, result: OutcomeResultEnum.loss, placement: 2, teamIndex: 1 - winner),
];

List<Outcome> _drawOutcome() => [
  Outcome(playerIndex: 0, result: OutcomeResultEnum.draw, placement: 1, teamIndex: 0),
  Outcome(playerIndex: 1, result: OutcomeResultEnum.draw, placement: 1, teamIndex: 1),
];

class RpsLocalRulesV1 extends RpsV1LocalRulesBase {
  const RpsLocalRulesV1();

  @override
  Envelope<RpsV1State> initialState({
    required RpsV1Config config,
    required Rng rng,
    required int playerCount,
  }) => Envelope(
    state: RpsV1State(round: 1, wins: [0, 0], commits: [null, null], lastRound: null),
    pendingPlayers: [0, 1],
  );

  @override
  Envelope<RpsV1State> applyAction({
    required RpsV1State state,
    required List<int> pending,
    required RpsV1Action data,
    required int playerIndex,
    required Rng rng,
    required RpsV1Config config,
  }) {
    final other = 1 - playerIndex;
    final otherMove = state.commits[other];
    if (otherMove == null) {
      // First commit of the round: record it, wait for the opponent.
      final commits = List<RpsV1Move?>.filled(2, null);
      commits[playerIndex] = data.move;
      return Envelope(
        state: RpsV1State(
          round: state.round,
          wins: state.wins,
          commits: commits,
          lastRound: state.lastRound,
        ),
        pendingPlayers: [other],
      );
    }
    // Second commit: resolve the round, and maybe the match.
    final pair = playerIndex == 0
        ? [data.move, otherMove]
        : [otherMove, data.move];
    final winner = _beats(pair[0], pair[1])
        ? 0
        : _beats(pair[1], pair[0])
            ? 1
            : null;
    final wins = [...state.wins];
    if (winner != null) wins[winner] += 1;
    final lastRound = RpsV1Round(moves: pair, winner: winner);

    if (winner != null && wins[winner] >= config.targetWins) {
      return Envelope(
        state: RpsV1State(
          round: state.round,
          wins: wins,
          commits: const [null, null],
          lastRound: lastRound,
        ),
        pendingPlayers: const [],
        outcome: _matchOutcome(winner),
      );
    }
    return Envelope(
      state: RpsV1State(
        round: state.round + 1,
        wins: wins,
        commits: const [null, null],
        lastRound: lastRound,
      ),
      pendingPlayers: const [0, 1],
    );
  }

  @override
  Envelope<RpsV1State> applyLifecycle({
    required RpsV1State state,
    required List<int> pending,
    required LifecycleType type,
    required LifecycleAction data,
    required Rng rng,
    required RpsV1Config config,
  }) {
    if (type == LifecycleType.timeout) {
      // Every pending seat failed to commit. Both idle ⇒ a draw; one idle ⇒
      // the seat that did commit takes the match.
      if (pending.length == 2) {
        return Envelope(state: state, pendingPlayers: const [], outcome: _drawOutcome());
      }
      return Envelope(
        state: state,
        pendingPlayers: const [],
        outcome: _matchOutcome(1 - pending[0]),
      );
    }
    final loser = data.playerIndex!;
    return Envelope(
      state: state,
      pendingPlayers: const [],
      outcome: _matchOutcome(1 - loser),
    );
  }

  @override
  ObservationSlice<RpsV1Observation> computeObservation({
    required RpsV1State state,
    required List<int> pending,
    required int? playerIndex,
    required int participantCount,
    required TransitionCause<RpsV1Action> cause,
    required bool isReplay,
    required RpsV1Config config,
  }) {
    if (isReplay || playerIndex == null) {
      // Post-game: reveal everything.
      return ObservationSlice(
        data: RpsV1Observation(
          round: state.round,
          wins: state.wins,
          lastRound: state.lastRound,
          commits: state.commits,
        ),
        pendingPlayers: pending,
      );
    }
    // Live: the opponent's commit and pending status stay hidden.
    return ObservationSlice(
      data: RpsV1Observation(
        round: state.round,
        wins: state.wins,
        lastRound: state.lastRound,
        yourMove: state.commits[playerIndex],
      ),
      pendingPlayers: pending.where((seat) => seat == playerIndex).toList(),
    );
  }

  @override
  Map<String, LocalBotAction<RpsV1Action, RpsV1Observation, RpsV1Config>>
  get botActions => {
    'rps-random': (args) {
      const moves = [RpsV1Move.rock, RpsV1Move.paper, RpsV1Move.scissors];
      return RpsV1Action(move: moves[(args.rng.next() * moves.length).floor()]);
    },
  };
}
```

`botActions` is keyed by the bot registry's `username`, exactly like the
TypeScript map on the same version unit. A username present in **both** maps
is one bot playable in a server game and in a local one; a username present
only here is a `local`-type registry row that can never be seated online. See
[Bots](./bots.md).

## Determinism: the same seed draws the same values

Import replays the device's actions through the TypeScript rules at the exact
version they committed as, so every random draw a hook makes on the device
must be the value the TypeScript rules would have drawn for the same seed. A
draw that is merely close is a draw that desynchronizes the very next one.

`EigenRng` is a bit-exact port of the kernel's stream, including its 32-bit
arithmetic on the web, where Dart's `int` is a JavaScript number.
`EigenRng.forTransition(seed, version)` matches the server's per-transition
stream and `EigenRng.forBot(seed, seat, version)` matches its per-seat bot
stream, so a Dart `rps-random` brain that draws once from `args.rng.next()`
gets the exact float the TypeScript `rps-random` would have — and therefore
the same index into the same three-move list, the same move.

This is proven by fixtures, not by inspection: the `rng` fixture kind records
raw draws off the real TypeScript kernel, and the Dart runner checks
`EigenRng` against them with exact equality. See
[Testing](./testing.md#the-four-kinds-for-offline-play).

## Which bots can play locally

A bot is seatable in a local game only when its registry row is type `local`
or `engine` **and** the version's local unit declares a `botActions` entry for
its username. An `external` bot can never be seated locally: there is no
webhook to call with the device offline, and the create-local route rejects
one with `notLocalBot`.

- **`engine`**: the same identity the server can also dispatch; a local game
  runs the Dart transcription of its brain instead of the TypeScript one.
- **`local`**: an identity-only registry row with no server-side brain at
  all — a bot that only ever plays on-device.

The solo picker filters to exactly this set, with no network call: whatever
username the local unit's `botActions` names, for a bot whose type is not
`external`. See [Bots](./bots.md) and [How bots work](../how-it-works/bots.md).

## Sync: nothing to implement

Sync is engine-owned; there is no implementor hook for it. In the background —
on app start, on connectivity regained, and when a local game finishes — the
device registers the game once and then appends batches of its transition log
against the game's current version. The server does not trust the device's
moves: it replays each one through the same TypeScript rules a live move
takes, and a batch stops at the first rejection.

A rejection means the Dart local unit and the TypeScript unit disagreed about
the same transition. That is a twin bug, not a network failure: the record is
marked `diverged`, local play on it stops, and the player is shown the
server's copy rather than having it resolved silently in either direction.
Keeping the [twin fixtures](./testing.md) rich, especially the `transcript`
kind, is what catches this before a player does.

A refusal for a stale version is not by itself a disagreement. If the response
to an append is lost, the server ends up holding your own moves at a version
your device does not expect it to be at — which looks exactly like another
device having played different moves. The client settles it by comparing the
state the server holds at its own version with the state it committed there,
and only a difference in that state is a divergence. Nothing about this is
yours to implement; it matters because it is why a flaky connection does not
cost a player their game.

## Running a brain: what has to be sendable

A brain has unbounded cost, so the engine never runs one inline. On native it
runs in a short-lived isolate; on the web, where Flutter has no isolates, it
runs on the main thread. Both constraints follow from that:

- **Everything crossing into the brain must be sendable**: a `const` rules
  unit and plain JSON-like values. A brain that closes over a provider, a
  widget, or any other live object cannot be copied to an isolate and fails on
  native.
- **A brain that thinks for a while must yield cooperatively on the web**,
  since nothing else preempts it there. `LocalBotAction`'s `FutureOr` return
  exists for exactly this: an `async` brain that `await`s between plies gives
  the frame back between them. Something as fast as `rps-random` can simply
  return synchronously.

While a brain runs, the human's controls are already disabled through the
existing `actionPending` state; a game needs no "thinking" affordance of its
own.

## Playing on a second device

A local game is on one device until it synchronizes, and afterwards it is on
any of its owner's. Opening one from another of their devices brings it there:
the app reads the record the server kept, re-derives every seat's frame through
its own copy of your rules, and plays on from the version the first device
reached. Nothing is implemented for this either.

It is declined, and the game stays readable rather than playable, when the
second device cannot actually run it: an older build with no local unit for the
game's version, or one that ships no brain for a bot on its roster. That second
case is the realistic one, because a bot added in a later release is a bot an
older install has never heard of.

Two devices playing the same game at once is resolved the way any divergence
is. Each device appends against the version it believes the server is at, so
the second one to append is refused, keeps only what the server accepted, and
is marked `diverged`. Opening that game again pulls the server's record in its
place, so the game carries on from what the server holds rather than becoming
one the player can never reopen.

## What is not supported

A local game is deliberately narrow: one human, only bots, untimed, and never
rated. There is no local multiplayer, no local timer, and no way to make a
local game public — all of those need a network, so play them online instead.
