import 'dart:math';

import 'package:eigen_api/eigen_api.dart';

import 'local_kernel.dart';

/// One committed transition of a local game: what the Durable Object stores per
/// version, minus the engine's clocks.
///
/// The state is kept alongside the action because the record is the whole game:
/// a device continuing a pulled game rebuilds from the newest state, and the
/// import route replays the actions.
final class LocalGameTransition {
  const LocalGameTransition({
    required this.version,
    required this.state,
    required this.action,
    required this.pending,
  });

  factory LocalGameTransition.fromJson(Map<String, dynamic> json) {
    final action = json['action'];
    return LocalGameTransition(
      version: json['version'] as int,
      state: (json['state'] as Map).cast<String, dynamic>(),
      action: action == null
          ? null
          : LocalTransitionAction.fromJson(
              (action as Map).cast<String, dynamic>(),
            ),
      pending: (json['pending'] as List).cast<int>(),
    );
  }

  final int version;
  final Map<String, dynamic> state;

  /// The move that produced this state, or null at version 0, which no action
  /// produced.
  final LocalTransitionAction? action;

  final List<int> pending;

  Map<String, dynamic> toJson() => {
    'version': version,
    'state': state,
    'action': action?.toJson(),
    'pending': pending,
  };
}

/// A whole local game as the device holds it: the record [LocalGameStore]
/// persists and [LocalGameEngine] advances.
///
/// This is the device's copy of what the Durable Object holds for a server
/// game: meta, roster, the append-only transition log with state and action,
/// and the per-seat frames. It is a game record, not a command queue: there is
/// no command identity, receipt, or retry policy in it (decision 0012), and
/// synchronization is append-only replay of [transitions] into the
/// authoritative object.
final class LocalGameRecord {
  const LocalGameRecord({
    required this.id,
    required this.createdBy,
    required this.createdAt,
    required this.schemaVersion,
    required this.config,
    required this.seed,
    required this.roster,
    required this.status,
    required this.seq,
    required this.transitions,
    required this.frames,
    this.outcomes,
    this.finishedAt,
    this.syncedVersion = notSynced,
    this.remoteCreated = false,
    this.diverged = false,
  });

  factory LocalGameRecord.fromJson(Map<String, dynamic> json) {
    final outcomes = json['outcomes'] as List<dynamic>?;
    final finishedAt = json['finishedAt'] as int?;
    return LocalGameRecord(
      id: json['id'] as String,
      createdBy: json['createdBy'] as String,
      createdAt: DateTime.fromMillisecondsSinceEpoch(
        json['createdAt'] as int,
        isUtc: true,
      ),
      schemaVersion: json['schemaVersion'] as int,
      config: (json['config'] as Map).cast<String, dynamic>(),
      seed: json['seed'] as String,
      roster: [
        for (final seat in json['roster'] as List<dynamic>)
          LocalSeat.fromJson((seat as Map).cast<String, dynamic>()),
      ],
      status: GameStatus.values.firstWhere(
        (value) => value.value == json['status'],
        orElse: () => GameStatus.unknownDefaultOpenApi,
      ),
      seq: json['seq'] as int,
      transitions: [
        for (final transition in json['transitions'] as List<dynamic>)
          LocalGameTransition.fromJson(
            (transition as Map).cast<String, dynamic>(),
          ),
      ],
      frames: {
        for (final entry in (json['frames'] as Map).entries)
          int.parse(entry.key as String): [
            for (final frame in entry.value as List<dynamic>)
              LocalObservationFrame.fromJson(
                (frame as Map).cast<String, dynamic>(),
              ),
          ],
      },
      outcomes: outcomes == null
          ? null
          : [
              for (final outcome in outcomes)
                Outcome.fromJson((outcome as Map).cast<String, dynamic>()),
            ],
      finishedAt: finishedAt == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(finishedAt, isUtc: true),
      syncedVersion: json['syncedVersion'] as int,
      remoteCreated: json['remoteCreated'] as bool,
      diverged: json['diverged'] as bool,
    );
  }

  /// [syncedVersion] before the game exists on the server at all.
  static const notSynced = -1;

  /// The client-generated UUID, which is also the game's server id once it is
  /// imported: the create route is idempotent on it.
  final String id;

  /// The signed-in user who created the game, and its only human.
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
  /// Object does, so a local session snapshot orders against a server one.
  final int seq;

  /// The append-only log, version-ascending from 0.
  final List<LocalGameTransition> transitions;

  /// The per-seat projections, keyed by version. One entry per identified seat
  /// per version, exactly what the socket would have fanned out.
  final Map<int, List<LocalObservationFrame>> frames;

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
  int? get version => transitions.isEmpty ? null : transitions.last.version;

  /// The newest committed transition, or null before the start transition.
  LocalGameTransition? get latest =>
      transitions.isEmpty ? null : transitions.last;

  /// Whether the game has reached a status nothing can move it out of.
  bool get isTerminal =>
      status == GameStatus.finished || status == GameStatus.aborted;

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

  /// One seat's frame at [version], or null when the seat held no identity at
  /// that version.
  LocalObservationFrame? frameFor({required int seat, required int version}) {
    for (final frame in frames[version] ?? const <LocalObservationFrame>[]) {
      if (frame.playerIndex == seat) return frame;
    }
    return null;
  }

  /// The seat the signed-in human holds, or null for a record whose roster has
  /// no human (which the engine never mints).
  int? get humanSeat {
    for (final seat in roster) {
      if (seat.userId != null) return seat.playerIndex;
    }
    return null;
  }

  LocalGameRecord copyWith({
    GameStatus? status,
    int? seq,
    List<LocalGameTransition>? transitions,
    Map<int, List<LocalObservationFrame>>? frames,
    List<Outcome>? outcomes,
    DateTime? finishedAt,
    int? syncedVersion,
    bool? remoteCreated,
    bool? diverged,
  }) => LocalGameRecord(
    id: id,
    createdBy: createdBy,
    createdAt: createdAt,
    schemaVersion: schemaVersion,
    config: config,
    seed: seed,
    roster: roster,
    status: status ?? this.status,
    seq: seq ?? this.seq,
    transitions: transitions ?? this.transitions,
    frames: frames ?? this.frames,
    outcomes: outcomes ?? this.outcomes,
    finishedAt: finishedAt ?? this.finishedAt,
    syncedVersion: syncedVersion ?? this.syncedVersion,
    remoteCreated: remoteCreated ?? this.remoteCreated,
    diverged: diverged ?? this.diverged,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'createdBy': createdBy,
    'createdAt': createdAt.toUtc().millisecondsSinceEpoch,
    'schemaVersion': schemaVersion,
    'config': config,
    'seed': seed,
    'roster': [for (final seat in roster) seat.toJson()],
    'status': status.value,
    'seq': seq,
    'transitions': [for (final transition in transitions) transition.toJson()],
    'frames': {
      for (final entry in frames.entries)
        '${entry.key}': [for (final frame in entry.value) frame.toJson()],
    },
    'outcomes': outcomes == null
        ? null
        : [for (final outcome in outcomes!) outcome.toJson()],
    'finishedAt': finishedAt?.toUtc().millisecondsSinceEpoch,
    'syncedVersion': syncedVersion,
    'remoteCreated': remoteCreated,
    'diverged': diverged,
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
/// stored on the record, and sent to the server on import rather than
/// regenerated there.
String newLocalSeed([Random? random]) {
  final source = random ?? Random.secure();
  return [
    for (var index = 0; index < 16; index++)
      source.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ].join();
}
