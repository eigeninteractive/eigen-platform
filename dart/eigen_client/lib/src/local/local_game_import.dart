import 'package:eigen_api/eigen_api.dart';

import 'local_game.dart';
import 'local_game_storage.dart';
import 'local_kernel.dart';
import 'local_rules.dart';

/// Rebuilds a local game from the server's copy of it.
///
/// The inverse of synchronization, and the second half of decision 0012's
/// "Resuming a local game on another device": the import route carries the
/// seed, the raw state and the action log, which is everything the game is,
/// and this turns them back into what the replica stores for a game this device
/// decides.
///
/// The human's frames are **re-projected rather than transferred**. They are
/// derivable from the state and the action that produced it, so sending them
/// would be sending the same facts twice and inviting the two copies to
/// disagree; re-deriving them here also proves, at the moment of import, that
/// this build's rules can actually read this game. That is the same reasoning
/// the server applies when it re-projects a finished game for replay instead
/// of storing the frames forever.
///
/// [rules] must be the unit for the game's own `schemaVersion`, and the caller
/// must already have established that this build ships a brain for every bot on
/// the roster; an engine over a game whose bots cannot move is a game nothing
/// will ever advance.
RebuiltLocalGame localGameFromRemote({
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
  final roster = [for (final seat in session.players) LocalSeat.fromSeat(seat)];
  final humanSeat = roster
      .where((seat) => seat.userId == createdBy)
      .map((seat) => seat.playerIndex)
      .firstOrNull;
  if (humanSeat == null) {
    throw const FormatException(
      'A local game seats its creator; this roster does not',
    );
  }

  // Completeness, before anything is rebuilt from it. The engine resumes from
  // the newest version, and upload pages the log from the synchronized one, so
  // a gap or a short tail is not a degraded game, it is a different game. The
  // route pages, and a caller that forgot to follow the pages would otherwise
  // produce a game that resumes from the middle of the match while claiming the
  // server's own version.
  final serverVersion = session.version ?? 0;
  if (remote.transitions.length != serverVersion + 1) {
    throw FormatException(
      'A local game at version $serverVersion has ${serverVersion + 1} '
      'transitions; this record carries ${remote.transitions.length}',
    );
  }

  final transitions = <LocalGameTransition>[];
  final frames = <LocalObservationFrame>[];
  for (final row in remote.transitions) {
    if (row.version != transitions.length) {
      throw FormatException(
        'The log jumps to version ${row.version} where '
        '${transitions.length} was expected',
      );
    }
    final transition = LocalGameTransition(
      version: row.version,
      state: (row.state as Map).cast<String, dynamic>(),
      action: row.action == null ? null : _actionOf(row.action!),
      pending: row.pending,
    );
    transitions.add(transition);
    frames.add(
      projectTransition(
        rules,
        transition: transition,
        config: config,
        participantCount: roster.length,
      ).firstWhere((frame) => frame.playerIndex == humanSeat),
    );
  }

  return (
    game: LocalGame(
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
      latest: transitions.last,
      outcomes: session.frame?.outcomes,
      finishedAt: remote.finishedAt == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(
              remote.finishedAt!,
              isUtc: true,
            ),
      // The server already holds every version this game has, which is the
      // whole reason it could be pulled. Anything played from here syncs on
      // top.
      remoteCreated: true,
      syncedVersion: serverVersion,
    ),
    transitions: transitions,
    frames: frames,
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
