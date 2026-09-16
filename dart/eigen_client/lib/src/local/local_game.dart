import 'dart:math';

import 'package:eigen_api/eigen_api.dart';

import 'local_kernel.dart';
import 'local_rules.dart';

/// One committed transition of a local game: what the Durable Object stores per
/// version, minus the engine's clocks.
///
/// The state is kept beside the action because the log is the game: a device
/// continuing a pulled game rebuilds from the newest state, and the import route
/// replays the actions.
final class LocalGameTransition {
  const LocalGameTransition({
    required this.version,
    required this.state,
    required this.action,
    required this.pending,
  });

  final int version;
  final Map<String, dynamic> state;

  /// The move that produced this state, or null at version 0, which no action
  /// produced.
  final LocalTransitionAction? action;

  final List<int> pending;
}

/// A local game as the engine holds it in memory: everything but the log.
///
/// The log itself lives in the replica's `transitions` table, one row per
/// version, and is read only where it is needed: its newest entry to commit
/// against, a page after the synchronized version to upload, one state to
/// settle a stale append. Nothing here is rewritten wholesale on a move; a
/// commit appends one transition and one frame, and updates the game's row
/// (decision 0013).
final class LocalGame {
  const LocalGame({
    required this.id,
    required this.createdBy,
    required this.createdAt,
    required this.schemaVersion,
    required this.config,
    required this.seed,
    required this.roster,
    required this.status,
    required this.seq,
    required this.latest,
    this.outcomes,
    this.finishedAt,
    this.syncedVersion = notSynced,
    this.remoteCreated = false,
    this.diverged = false,
  });

  /// [syncedVersion] before the game exists on the server at all.
  static const notSynced = -1;

  /// The client-generated UUID, which is also the game's server id once it is
  /// imported: the create route is idempotent on it.
  final String id;

  /// The signed-in user who created the game, and its only human. Also the
  /// account whose replica holds it.
  final String createdBy;

  final DateTime createdAt;
  final int schemaVersion;
  final Map<String, dynamic> config;

  /// The 128-bit base seed every transition's and every bot's stream derives
  /// from. Sent to the server on import so its replay draws the same values.
  final String seed;

  final List<LocalSeat> roster;
  final GameStatus status;

  /// Monotonic per game, incremented by every commit exactly as the Durable
  /// Object does. The device numbers it; the server numbers its imported copy
  /// independently, and the two are never compared.
  final int seq;

  /// The newest committed transition, or null before the start transition.
  final LocalGameTransition? latest;

  /// Per-seat results once the game ends, else null.
  final List<Outcome>? outcomes;

  final DateTime? finishedAt;

  /// The highest version the server has accepted, or [notSynced] when the game
  /// has not been created remotely. Synchronization resumes from it.
  final int syncedVersion;

  /// Whether the create route has accepted this game.
  final bool remoteCreated;

  /// Whether the server refused one of this game's transitions. A divergence
  /// is a twin defect: local play stops and the server's copy is what the
  /// player is shown, never silently resolved in the client's favour.
  final bool diverged;

  /// The newest committed version, or null before the start transition.
  int? get version => latest?.version;

  /// Whether the game has reached a status nothing can move it out of.
  bool get isTerminal =>
      status == GameStatus.finished || status == GameStatus.aborted;

  /// Whether the server lacks anything this device committed.
  bool get needsSync =>
      !diverged && (!remoteCreated || syncedVersion < (version ?? 0));

  /// The standing configuration the kernel reads.
  LocalGameMeta get meta => LocalGameMeta(
    status: status,
    schemaVersion: schemaVersion,
    config: config,
    createdBy: createdBy,
  );

  /// The latest state row the kernel commits against, or null before v0.
  LocalStateRow? get stateRow {
    final transition = latest;
    if (transition == null) return null;
    return LocalStateRow(
      version: transition.version,
      state: transition.state,
      pending: transition.pending,
      rngSeed: seed,
    );
  }

  /// The seat the signed-in human holds.
  int get humanSeat {
    for (final seat in roster) {
      if (seat.userId != null) return seat.playerIndex;
    }
    throw StateError('Local game $id has no human seat');
  }

  LocalGame copyWith({
    GameStatus? status,
    int? seq,
    LocalGameTransition? latest,
    List<Outcome>? outcomes,
    DateTime? finishedAt,
    int? syncedVersion,
    bool? remoteCreated,
    bool? diverged,
  }) => LocalGame(
    id: id,
    createdBy: createdBy,
    createdAt: createdAt,
    schemaVersion: schemaVersion,
    config: config,
    seed: seed,
    roster: roster,
    status: status ?? this.status,
    seq: seq ?? this.seq,
    latest: latest ?? this.latest,
    outcomes: outcomes ?? this.outcomes,
    finishedAt: finishedAt ?? this.finishedAt,
    syncedVersion: syncedVersion ?? this.syncedVersion,
    remoteCreated: remoteCreated ?? this.remoteCreated,
    diverged: diverged ?? this.diverged,
  );
}

/// Every seat's projection of [transition]: what the commit that produced it
/// fanned out.
///
/// Projection is pure, so re-deriving it gives exactly the frames the commit
/// produced. That is what lets the replica keep only the human's frames: a bot's
/// observation is derived when its brain runs, from the state the log already
/// holds, rather than stored beside it.
List<LocalObservationFrame> projectTransition(
  AnyLocalGameRules rules, {
  required LocalGameTransition transition,
  required Map<String, dynamic> config,
  required int participantCount,
}) => fanOutObservations(
  rules,
  state: rules.parseState(transition.state),
  pending: transition.pending,
  participantCount: participantCount,
  cause: causeOf(transition.action, rules),
  isReplay: false,
  config: rules.parseConfig(config),
);

/// What the projection is told produced a state, erased for the fan-out.
TransitionCause<Object?> causeOf(
  LocalTransitionAction? action,
  AnyLocalGameRules rules,
) {
  if (action == null) return const NoCause<Object?>();
  return switch (action.kind) {
    LocalActionKind.game => GameCause<Object?>(
      data: rules.parseAction(action.data),
      playerIndex: action.playerIndex ?? 0,
    ),
    LocalActionKind.lifecycle => LifecycleCause<Object?>(
      data: LifecycleAction.fromJson(action.data),
    ),
  };
}

/// A fresh game id: a random UUID the device mints, which the server adopts
/// verbatim when the game is imported.
///
/// Version 4, variant 1, which is what makes the id unguessable and collision
/// -free without a server round trip. Pass a [Random] only in a test; the
/// default is cryptographically secure.
String newLocalGameId([Random? random]) {
  final source = random ?? Random.secure();
  final bytes = List<int>.generate(16, (_) => source.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  String hex(int start, int end) => [
    for (var index = start; index < end; index++)
      bytes[index].toRadixString(16).padLeft(2, '0'),
  ].join();
  return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
}

/// A fresh base RNG seed: 128 random bits, hex-encoded, exactly like the
/// kernel's `randomSeed()`.
///
/// The whole randomness of the game derives from it, so it is minted once,
/// stored with the game, and sent to the server on import rather than
/// regenerated there.
String newLocalSeed([Random? random]) {
  final source = random ?? Random.secure();
  return [
    for (var index = 0; index < 16; index++)
      source.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ].join();
}
