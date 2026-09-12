import 'package:eigen_client/eigen_client.dart';

/// A minimal but complete local game, used to exercise the kernel and the
/// engine without dragging a real game's contract into this package.
///
/// Deliberately typed rather than map-shaped: the kernel validates a hook's
/// state by round-tripping it through these codecs, and identity codecs would
/// make that guard vacuous.
final class CounterConfig {
  const CounterConfig(this.target);

  final int target;

  Map<String, dynamic> toJson() => {'target': target};

  static CounterConfig fromJson(Map<String, dynamic> json) {
    final target = json['target'];
    if (target is! int) throw const FormatException('config.target');
    return CounterConfig(target);
  }
}

final class CounterState {
  const CounterState({required this.scores, required this.turn});

  final List<int> scores;
  final int turn;

  Map<String, dynamic> toJson() => {'scores': scores, 'turn': turn};

  static CounterState fromJson(Map<String, dynamic> json) {
    final scores = json['scores'];
    final turn = json['turn'];
    if (scores is! List || turn is! int) {
      throw const FormatException('state');
    }
    return CounterState(scores: scores.cast<int>(), turn: turn);
  }
}

final class CounterObs {
  const CounterObs({
    required this.scores,
    required this.turn,
    required this.lastStep,
  });

  final List<int> scores;
  final int turn;
  final int? lastStep;

  Map<String, dynamic> toJson() => {
    'scores': scores,
    'turn': turn,
    'lastStep': lastStep,
  };

  static CounterObs fromJson(Map<String, dynamic> json) => CounterObs(
    scores: (json['scores'] as List).cast<int>(),
    turn: json['turn'] as int,
    lastStep: json['lastStep'] as int?,
  );
}

final class CounterAction {
  const CounterAction(this.step);

  final int step;

  Map<String, dynamic> toJson() => {'step': step};

  static CounterAction fromJson(Map<String, dynamic> json) {
    final step = json['step'];
    if (step is! int) throw const FormatException('action.step');
    return CounterAction(step);
  }
}

/// The counter game: seats take turns adding 1, 2 or 3 to their own score, and
/// the first to reach `config.target` wins.
class CounterRules
    extends
        LocalGameRules<CounterState, CounterObs, CounterAction, CounterConfig> {
  const CounterRules();

  @override
  Envelope<CounterState> initialState({
    required CounterConfig config,
    required Rng rng,
    required int playerCount,
  }) {
    // One draw, so a test can prove the start transition really used the
    // version-0 stream.
    final first = (rng.next() * playerCount).floor() % playerCount;
    return Envelope(
      state: CounterState(
        scores: List<int>.filled(playerCount, 0),
        turn: first,
      ),
      pendingPlayers: [first],
    );
  }

  @override
  Envelope<CounterState> applyAction({
    required CounterState state,
    required List<int> pending,
    required CounterAction data,
    required int playerIndex,
    required Rng rng,
    required CounterConfig config,
  }) {
    if (data.step < 1 || data.step > 3) {
      throw const IllegalMoveException('Step must be 1, 2 or 3');
    }
    final scores = [...state.scores];
    scores[playerIndex] += data.step;
    final next = (playerIndex + 1) % scores.length;
    final won = scores[playerIndex] >= config.target;
    return Envelope(
      state: CounterState(scores: scores, turn: won ? playerIndex : next),
      pendingPlayers: won ? const [] : [next],
      outcome: won ? _outcomes(scores, playerIndex) : null,
    );
  }

  @override
  Envelope<CounterState> applyLifecycle({
    required CounterState state,
    required List<int> pending,
    required LifecycleType type,
    required LifecycleAction data,
    required Rng rng,
    required CounterConfig config,
  }) {
    final loser = data.playerIndex ?? state.turn;
    final winner = (loser + 1) % state.scores.length;
    return Envelope(
      state: state,
      pendingPlayers: const [],
      outcome: _outcomes(state.scores, winner),
    );
  }

  @override
  ObservationSlice<CounterObs> computeObservation({
    required CounterState state,
    required List<int> pending,
    required int? playerIndex,
    required int participantCount,
    required TransitionCause<CounterAction> cause,
    required bool isReplay,
    required CounterConfig config,
  }) => ObservationSlice(
    data: CounterObs(
      scores: state.scores,
      turn: state.turn,
      lastStep: switch (cause) {
        GameCause<CounterAction>(:final data) => data.step,
        _ => null,
      },
    ),
    pendingPlayers: pending,
  );

  @override
  Map<String, LocalBotAction<CounterAction, CounterObs, CounterConfig>>
  get botActions => {
    // Draws from its own stream, so a test can pin the bot derivation.
    'counter-bot': (args) => CounterAction(1 + (args.rng.next() * 3).floor()),
    'slow-bot': (args) async {
      await Future<void>.delayed(Duration.zero);
      return const CounterAction(1);
    },
    'broken-bot': (args) => throw StateError('brain exploded'),
    'cheating-bot': (args) => const CounterAction(99),
  };

  @override
  CounterConfig parseConfig(Map<String, dynamic> json) =>
      CounterConfig.fromJson(json);

  @override
  CounterState parseState(Map<String, dynamic> json) =>
      CounterState.fromJson(json);

  @override
  Map<String, dynamic> serializeState(CounterState state) => state.toJson();

  @override
  CounterAction parseAction(Map<String, dynamic> json) =>
      CounterAction.fromJson(json);

  @override
  Map<String, dynamic> serializeAction(CounterAction action) => action.toJson();

  @override
  CounterObs parseObservation(Map<String, dynamic> json) =>
      CounterObs.fromJson(json);

  @override
  Map<String, dynamic> serializeObservation(CounterObs observation) =>
      observation.toJson();
}

List<Outcome> _outcomes(List<int> scores, int winner) => [
  for (var seat = 0; seat < scores.length; seat++)
    Outcome(
      playerIndex: seat,
      result: seat == winner ? OutcomeResultEnum.win : OutcomeResultEnum.loss,
      placement: seat == winner ? 1 : 2,
      teamIndex: seat,
      score: scores[seat],
    ),
];

/// A unit whose `initialState` claims a seat nobody holds.
final class GhostPendingRules extends CounterRules {
  const GhostPendingRules();

  @override
  Envelope<CounterState> initialState({
    required CounterConfig config,
    required Rng rng,
    required int playerCount,
  }) => Envelope(
    state: CounterState(scores: List<int>.filled(playerCount, 0), turn: 0),
    pendingPlayers: [playerCount],
  );
}

/// A unit whose forfeit hook leaves the forfeited seat pending.
final class StickyForfeitRules extends CounterRules {
  const StickyForfeitRules();

  @override
  Envelope<CounterState> applyLifecycle({
    required CounterState state,
    required List<int> pending,
    required LifecycleType type,
    required LifecycleAction data,
    required Rng rng,
    required CounterConfig config,
  }) => Envelope(state: state, pendingPlayers: [data.playerIndex ?? 0]);
}

/// A unit whose projection lies about the seat's own pending status.
final class LyingObservationRules extends CounterRules {
  const LyingObservationRules();

  @override
  ObservationSlice<CounterObs> computeObservation({
    required CounterState state,
    required List<int> pending,
    required int? playerIndex,
    required int participantCount,
    required TransitionCause<CounterAction> cause,
    required bool isReplay,
    required CounterConfig config,
  }) => ObservationSlice(
    data: CounterObs(scores: state.scores, turn: state.turn, lastStep: null),
    pendingPlayers: const [],
  );
}

/// A unit that returns a state its own codec cannot read back.
final class UnparseableStateRules extends CounterRules {
  const UnparseableStateRules();

  @override
  Map<String, dynamic> serializeState(CounterState state) => const {
    'scores': 'not a list',
  };
}

/// A unit that ends the game with an outcome for a seat that does not exist.
final class StrayOutcomeRules extends CounterRules {
  const StrayOutcomeRules();

  @override
  Envelope<CounterState> applyAction({
    required CounterState state,
    required List<int> pending,
    required CounterAction data,
    required int playerIndex,
    required Rng rng,
    required CounterConfig config,
  }) => Envelope(
    state: state,
    pendingPlayers: const [],
    outcome: [
      Outcome(
        playerIndex: 42,
        result: OutcomeResultEnum.win,
        placement: 1,
        teamIndex: 0,
      ),
    ],
  );
}

/// A unit that ends the game with no outcome entries at all.
final class EmptyOutcomeRules extends CounterRules {
  const EmptyOutcomeRules();

  @override
  Envelope<CounterState> applyAction({
    required CounterState state,
    required List<int> pending,
    required CounterAction data,
    required int playerIndex,
    required Rng rng,
    required CounterConfig config,
  }) => Envelope(state: state, pendingPlayers: const [], outcome: const []);
}

/// The two-seat roster every test here plays on: one human, one bot.
List<LocalSeat> counterRoster({String botUsername = 'counter-bot'}) => const [
  LocalSeat(
    playerIndex: 0,
    userId: 'user-1',
    botId: null,
    type: SeatTypeEnum.human,
  ),
  LocalSeat(
    playerIndex: 1,
    userId: null,
    botId: 'bot-1',
    type: SeatTypeEnum.bot,
  ),
];

/// A registry row for the in-test brain.
Bot counterBot({String id = 'bot-1', String username = 'counter-bot'}) => Bot(
  id: id,
  username: username,
  displayName: 'Counter Bot',
  avatarUrl: null,
  schemaVersion: 1,
  // A brain this build ships is a `local` registry row; an `engine` row is
  // playable both ways.
  type: BotType.local,
  ratedEligible: false,
  config: const <String, dynamic>{},
);
