/// Schema version 1 of Rock–Paper–Scissors on the device: the Dart twin of the
/// four authoritative hooks in
/// `eigen-server/examples/rps/src/module/v1.ts`, plus the bot brains that
/// version registers.
///
/// This is the offline half of the game, and it is optional: a game that never
/// implements it simply has no on-device play, and everything else about it is
/// unchanged. What it buys is a match played with no network, which the server
/// later replays through the very TypeScript unit this file transcribes, so the
/// two must agree move for move. The shared fixtures under `test/fixtures/v1/`
/// are what keeps them agreeing: `initialState`, `lifecycle` and `transcript`
/// cases run here and against the TypeScript unit from one recorded file.
///
/// Read it beside `v1.ts`. The hook names, the parameter names and the order of
/// the branches are deliberately the same, so the two read as one implementation
/// written twice rather than two implementations of one idea.
library;

import 'package:eigen_flutter/eigen_flutter.dart';

import 'models.dart';
import 'payloads.dart';

/// The seat `winner` beats, or null when the two throws do not decide.
int? _winnerOf(RpsV1Move first, RpsV1Move second) {
  if (first.beats(second)) return 0;
  if (second.beats(first)) return 1;
  return null;
}

List<Outcome> _matchOutcome(int winner) {
  final loser = winner == 0 ? 1 : 0;
  return [
    Outcome(
      playerIndex: winner,
      result: OutcomeResultEnum.win,
      placement: 1,
      teamIndex: winner,
    ),
    Outcome(
      playerIndex: loser,
      result: OutcomeResultEnum.loss,
      placement: 2,
      teamIndex: loser,
    ),
  ];
}

List<Outcome> _drawOutcome() => [
  for (var seat = 0; seat < 2; seat++)
    Outcome(
      playerIndex: seat,
      result: OutcomeResultEnum.draw,
      placement: 1,
      teamIndex: seat,
    ),
];

/// The v1 local unit, returned from `RpsRulesV1.local`.
class RpsLocalRulesV1 extends RpsV1LocalRulesBase {
  const RpsLocalRulesV1();

  @override
  Envelope<RpsV1State> initialState({
    required RpsV1Config config,
    required Rng rng,
    required int playerCount,
  }) => Envelope(
    state: RpsV1State(
      round: 1,
      wins: const [0, 0],
      commits: const [null, null],
      lastRound: null,
    ),
    pendingPlayers: const [0, 1],
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
    // Unreachable through the engine (a committed seat is no longer pending);
    // kept as the defensive rules-level invariant its twin keeps.
    if (state.commits[playerIndex] != null) {
      throw const IllegalMoveException('You already committed this round');
    }
    final other = 1 - playerIndex;
    final otherMove = state.commits[other];

    if (otherMove == null) {
      // First commit of the round: record it, wait for the opponent.
      final commits = <RpsV1Move?>[null, null];
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

    // Second commit: resolve the round.
    final moves = playerIndex == 0
        ? [data.move, otherMove]
        : [otherMove, data.move];
    final winner = _winnerOf(moves[0], moves[1]);
    final wins = [...state.wins];
    if (winner != null) wins[winner] += 1;
    final lastRound = RpsV1Round(moves: moves, winner: winner);

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
      // Every pending seat failed to commit in time. Both idle means a drawn
      // match; one idle means the seat that did commit takes it.
      if (pending.length == 2) {
        return Envelope(
          state: state,
          pendingPlayers: const [],
          outcome: _drawOutcome(),
        );
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
      // Post-game (participant replay or public viewer): reveal everything.
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
    // Live projection, with the two omissions that ARE the game: the
    // opponent's commit is hidden, and so is their pending status, so a hidden
    // commit never changes this seat's view.
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

  /// The device-side brains, keyed by the same bot usernames the TypeScript
  /// unit's `botActions` uses. `rps-random` draws once from the seat's stream,
  /// which the server derives identically, so the two halves choose the same
  /// throw for the same turn.
  @override
  Map<String, LocalBotAction<RpsV1Action, RpsV1Observation, RpsV1Config>>
  get botActions => {
    'rps-random': (args) => RpsV1Action(
      move:
          RpsV1Move.values[(args.rng.next() * RpsV1Move.values.length).floor()],
    ),
  };
}
