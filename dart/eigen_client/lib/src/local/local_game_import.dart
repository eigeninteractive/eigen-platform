import 'package:eigen_api/eigen_api.dart';

import 'local_game.dart';
import 'local_kernel.dart';
import 'local_rules.dart';

/// Rebuilds the device's record of a local game from the server's copy.
///
/// The inverse of synchronization, and the second half of decision 0012's
/// "Resuming a local game on another device": the import route carries the
/// seed, the raw state and the action log, which is everything the game is,
/// and this turns them back into the record a [LocalGameEngine] runs.
///
/// The per-seat frames are **re-projected rather than transferred**. They are
/// derivable from the state and the action that produced it, so sending them
/// would be sending the same facts twice and inviting the two copies to
/// disagree; re-deriving them here also proves, at the moment of import, that
/// this build's rules can actually read this game. That is the same reasoning
/// the server applies when it re-projects a finished game for replay instead
/// of storing the frames forever.
///
/// [rules] must be the unit for the record's own `schemaVersion`, and the
/// caller must already have established that this build ships a brain for every
/// bot on the roster; an engine built over a record whose bots cannot move is a
/// game nothing will ever advance.
LocalGameRecord localRecordFromRemote({
  required LocalRecord remote,
  required AnyLocalGameRules rules,
}) {
  final session = remote.session;
  final createdBy = session.createdBy;
  if (createdBy == null) {
    throw const FormatException(
      'A local game always has a creator; this record has none',
    );
  }
  final config = (session.config as Map).cast<String, dynamic>();
  final parsedConfig = rules.parseConfig(config);
  final roster = [for (final seat in session.players) LocalSeat.fromSeat(seat)];

  // Completeness, before anything is rebuilt from it. The engine replays the
  // log from version 0, so a gap or a short tail is not a degraded record, it
  // is a different game. The route pages, and a caller that forgot to follow
  // the pages would otherwise produce a record that resumes from the middle of
  // the match while claiming the server's own version.
  final serverVersion = session.version ?? 0;
  if (remote.transitions.length != serverVersion + 1) {
    throw FormatException(
      'A local game at version $serverVersion has ${serverVersion + 1} '
      'transitions; this record carries ${remote.transitions.length}',
    );
  }

  final transitions = <LocalGameTransition>[];
  final frames = <int, List<LocalObservationFrame>>{};
  for (final row in remote.transitions) {
    if (row.version != transitions.length) {
      throw FormatException(
        'The log jumps to version ${row.version} where '
        '${transitions.length} was expected',
      );
    }
    final state = (row.state as Map).cast<String, dynamic>();
    final action = row.action == null ? null : _actionOf(row.action!);
    transitions.add(
      LocalGameTransition(
        version: row.version,
        state: state,
        action: action,
        pending: row.pending,
      ),
    );
    frames[row.version] = fanOutObservations(
      rules,
      state: rules.parseState(state),
      pending: row.pending,
      participantCount: roster.length,
      cause: _causeOf(action, rules),
      isReplay: false,
      config: parsedConfig,
    );
  }

  return LocalGameRecord(
    id: session.gameId,
    createdBy: createdBy,
    createdAt: DateTime.fromMillisecondsSinceEpoch(
      remote.createdAt,
      isUtc: true,
    ),
    schemaVersion: session.schemaVersion,
    config: config,
    seed: remote.seed,
    roster: roster,
    status: session.status,
    seq: session.seq,
    transitions: transitions,
    frames: frames,
    outcomes: session.frame?.outcomes,
    finishedAt: remote.finishedAt == null
        ? null
        : DateTime.fromMillisecondsSinceEpoch(remote.finishedAt!, isUtc: true),
    // The server already holds every version this record has, which is the
    // whole reason it could be pulled. Anything played from here syncs on top.
    remoteCreated: true,
    syncedVersion: session.version ?? 0,
  );
}

/// One logged action off the wire.
LocalTransitionAction _actionOf(TransitionAction action) {
  if (action.kind == TransitionActionKindEnum.ratings) {
    // Engine-owned and unreachable here: a local game is never rated, so the
    // ratings transition the server appends after a rated finish cannot exist.
    throw const FormatException(
      'A local game cannot carry a ratings transition',
    );
  }
  return LocalTransitionAction(
    type: LocalActionType.fromWire(action.type.value),
    kind: LocalActionKind.fromWire(action.kind.value),
    data: (action.data as Map).cast<String, dynamic>(),
    playerIndex: action.playerIndex,
  );
}

/// What the projection is told produced a state, erased for the fan-out.
TransitionCause<Object?> _causeOf(
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
