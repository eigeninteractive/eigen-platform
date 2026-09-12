import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';

/// Minimal tic-tac-toe-like observation: a flat board of 9 cells where each
/// entry is the occupying player index, or null if empty.
///
/// Value equality (like a Freezed model's) so twin-fixture preview
/// comparisons can use `==`.
class SampleObservation {
  const SampleObservation(this.board);

  factory SampleObservation.fromJson(Map<String, dynamic> json) =>
      SampleObservation((json['board'] as List).map((e) => e as int?).toList());

  final List<int?> board;

  Map<String, dynamic> toJson() => {'board': board};

  @override
  bool operator ==(Object other) =>
      other is SampleObservation && listEquals(other.board, board);

  @override
  int get hashCode => Object.hashAll(board);
}

/// Candidate move: place a mark in [cell].
class SampleAction {
  const SampleAction(this.cell);

  factory SampleAction.fromJson(Map<String, dynamic> json) =>
      SampleAction(json['cell'] as int);

  final int cell;

  Map<String, dynamic> toJson() => {'cell': cell};
}

/// No per-instance configuration for the sample game.
class SampleConfig {
  const SampleConfig();
}

/// The schema-version-1 rules unit of the sample game.
///
/// Real games inherit these JSON methods from their generated rules base. This
/// handwritten test fixture implements them directly so it has no generated
/// artifact.
class SampleRules
    extends GameRules<SampleObservation, SampleAction, SampleConfig> {
  const SampleRules();

  @override
  PlayerLimits playerLimits(SampleConfig config) =>
      const PlayerLimits(minPlayers: 2, maxPlayers: 2);

  @override
  SampleConfig parseConfig(Map<String, dynamic> json) => const SampleConfig();

  @override
  SampleObservation parseObservation(Map<String, dynamic> json) =>
      SampleObservation.fromJson(json);

  @override
  SampleAction parseAction(Map<String, dynamic> json) =>
      SampleAction.fromJson(json);

  @override
  Map<String, dynamic> serializeAction(SampleAction action) => action.toJson();

  @override
  bool isValidAction({
    required SampleObservation obs,
    required List<int> pending,
    required SampleAction data,
    required int playerIndex,
    required SampleConfig config,
  }) {
    if (!pending.contains(playerIndex)) return false;
    if (data.cell < 0 || data.cell >= obs.board.length) return false;
    return obs.board[data.cell] == null;
  }

  @override
  SampleObservation? previewAction({
    required SampleObservation obs,
    required List<int> pending,
    required SampleAction data,
    required int playerIndex,
    required SampleConfig config,
  }) {
    final board = List<int?>.of(obs.board);
    board[data.cell] = playerIndex;
    return SampleObservation(board);
  }

  @override
  Widget buildContent(GameContentContext context) => const SizedBox.shrink();

  @override
  String? ratingPool(RatingPoolArgs args) =>
      args.access == GameAccess.public ? 'casual' : null;

  @override
  bool botSeatable(BotSeatableArgs args) => true;
}

/// The sample game with an on-device half, for the tests that exercise offline
/// play. Its only brain is `sample-bot`, so a picker filtered by
/// `usableLocalBots` keeps exactly the registry rows named that.
class LocalSampleRules extends SampleRules {
  const LocalSampleRules();

  @override
  SampleLocalRules get local => const SampleLocalRules();
}

/// The four authoritative hooks, on the device: a board where a move claims a
/// cell and the game ends when the board fills.
class SampleLocalRules
    extends
        LocalGameRules<
          Map<String, dynamic>,
          SampleObservation,
          SampleAction,
          SampleConfig
        > {
  const SampleLocalRules();

  @override
  SampleConfig parseConfig(Map<String, dynamic> json) => const SampleConfig();

  @override
  Map<String, dynamic> parseState(Map<String, dynamic> json) => json;

  @override
  Map<String, dynamic> serializeState(Map<String, dynamic> state) => state;

  @override
  SampleAction parseAction(Map<String, dynamic> json) =>
      SampleAction.fromJson(json);

  @override
  Map<String, dynamic> serializeAction(SampleAction action) => action.toJson();

  @override
  SampleObservation parseObservation(Map<String, dynamic> json) =>
      SampleObservation.fromJson(json);

  @override
  Map<String, dynamic> serializeObservation(SampleObservation obs) =>
      obs.toJson();

  @override
  Envelope<Map<String, dynamic>> initialState({
    required SampleConfig config,
    required Rng rng,
    required int playerCount,
  }) => Envelope(
    state: {'board': List<int?>.filled(9, null)},
    pendingPlayers: const [0],
  );

  @override
  Envelope<Map<String, dynamic>> applyAction({
    required Map<String, dynamic> state,
    required List<int> pending,
    required SampleAction data,
    required int playerIndex,
    required Rng rng,
    required SampleConfig config,
  }) {
    final board = List<int?>.of((state['board'] as List).cast<int?>());
    if (board[data.cell] != null) {
      throw const IllegalMoveException('That cell is taken');
    }
    board[data.cell] = playerIndex;
    final full = board.every((cell) => cell != null);
    return Envelope(
      state: {'board': board},
      pendingPlayers: full ? const [] : [1 - playerIndex],
      outcome: full ? _draw() : null,
    );
  }

  @override
  Envelope<Map<String, dynamic>> applyLifecycle({
    required Map<String, dynamic> state,
    required List<int> pending,
    required LifecycleType type,
    required LifecycleAction data,
    required Rng rng,
    required SampleConfig config,
  }) => Envelope(state: state, pendingPlayers: const [], outcome: _draw());

  @override
  ObservationSlice<SampleObservation> computeObservation({
    required Map<String, dynamic> state,
    required List<int> pending,
    required int? playerIndex,
    required int participantCount,
    required TransitionCause<SampleAction> cause,
    required bool isReplay,
    required SampleConfig config,
  }) => ObservationSlice(
    data: SampleObservation((state['board'] as List).cast<int?>()),
    pendingPlayers: pending,
  );

  @override
  Map<String, LocalBotAction<SampleAction, SampleObservation, SampleConfig>>
  get botActions => {
    'sample-bot': (args) => SampleAction(
      args.observation.data.board.indexWhere((cell) => cell == null),
    ),
  };
}

List<Outcome> _draw() => [
  for (var seat = 0; seat < 2; seat++)
    Outcome(
      playerIndex: seat,
      result: OutcomeResultEnum.draw,
      placement: 1,
      teamIndex: seat,
    ),
];

/// A minimal [GameModule] for use as a `currentGameModuleProvider` override.
class SampleModule extends GameModule {
  const SampleModule();

  @override
  Map<int, GameRules> get versions => const {1: SampleRules()};

  @override
  GameCreationSpec get creationSpec => const GameCreationSpec();

  @override
  Widget? buildCreationConfig({
    required ValueChanged<Map<String, dynamic>> onChanged,
  }) => null;

  @override
  Widget buildRules(BuildContext context) => const Text('Sample rules');
}
