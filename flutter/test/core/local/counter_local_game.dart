import 'package:eigen_client/eigen_client.dart';

/// A two-seat counting game: the smallest thing that exercises every hook.
///
/// Seat 0 and seat 1 alternate adding to a counter; the first to push it to
/// `target` wins. Deliberately perfect-information, so a projection is the
/// state and a fixture's `obs` and `state` coincide.
class CounterLocalRules
    extends
        LocalGameRules<
          Map<String, dynamic>,
          Map<String, dynamic>,
          Map<String, dynamic>,
          Map<String, dynamic>
        > {
  const CounterLocalRules();

  @override
  Map<String, dynamic> parseConfig(Map<String, dynamic> json) => json;

  @override
  Map<String, dynamic> parseState(Map<String, dynamic> json) => json;

  @override
  Map<String, dynamic> serializeState(Map<String, dynamic> state) => state;

  @override
  Map<String, dynamic> parseAction(Map<String, dynamic> json) => json;

  @override
  Map<String, dynamic> serializeAction(Map<String, dynamic> action) => action;

  @override
  Map<String, dynamic> parseObservation(Map<String, dynamic> json) => json;

  @override
  Map<String, dynamic> serializeObservation(Map<String, dynamic> obs) => obs;

  @override
  Envelope<Map<String, dynamic>> initialState({
    required Map<String, dynamic> config,
    required Rng rng,
    required int playerCount,
  }) => Envelope(state: {'count': 0}, pendingPlayers: const [0]);

  @override
  Envelope<Map<String, dynamic>> applyAction({
    required Map<String, dynamic> state,
    required List<int> pending,
    required Map<String, dynamic> data,
    required int playerIndex,
    required Rng rng,
    required Map<String, dynamic> config,
  }) {
    final add = data['add'] as int;
    if (add < 1) throw const IllegalMoveException('Add at least one');
    final count = (state['count'] as int) + add;
    final target = config['target'] as int;
    if (count >= target) {
      return Envelope(
        state: {'count': count},
        pendingPlayers: const [],
        outcome: [
          Outcome(
            playerIndex: playerIndex,
            result: OutcomeResultEnum.win,
            placement: 1,
            teamIndex: playerIndex,
          ),
          Outcome(
            playerIndex: 1 - playerIndex,
            result: OutcomeResultEnum.loss,
            placement: 2,
            teamIndex: 1 - playerIndex,
          ),
        ],
      );
    }
    return Envelope(state: {'count': count}, pendingPlayers: [1 - playerIndex]);
  }

  @override
  Envelope<Map<String, dynamic>> applyLifecycle({
    required Map<String, dynamic> state,
    required List<int> pending,
    required LifecycleType type,
    required LifecycleAction data,
    required Rng rng,
    required Map<String, dynamic> config,
  }) {
    final loser = data.playerIndex ?? pending.first;
    return Envelope(
      state: state,
      pendingPlayers: const [],
      outcome: [
        Outcome(
          playerIndex: 1 - loser,
          result: OutcomeResultEnum.win,
          placement: 1,
          teamIndex: 1 - loser,
        ),
        Outcome(
          playerIndex: loser,
          result: OutcomeResultEnum.loss,
          placement: 2,
          teamIndex: loser,
        ),
      ],
    );
  }

  @override
  ObservationSlice<Map<String, dynamic>> computeObservation({
    required Map<String, dynamic> state,
    required List<int> pending,
    required int? playerIndex,
    required int participantCount,
    required TransitionCause<Map<String, dynamic>> cause,
    required bool isReplay,
    required Map<String, dynamic> config,
  }) => ObservationSlice(data: state, pendingPlayers: pending);

  @override
  Map<
    String,
    LocalBotAction<
      Map<String, dynamic>,
      Map<String, dynamic>,
      Map<String, dynamic>
    >
  >
  get botActions => {
    // Deterministic, but drawn from the seat's stream so the job's rng is
    // exercised the way a real brain would exercise it.
    'counter-bot': (args) => {'add': 1 + (args.rng.next() * 2).floor()},
    'counter-broken': (args) => throw StateError('this brain is broken'),
  };
}
