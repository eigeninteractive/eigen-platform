import 'dart:async';

import '../domain/game_session.dart';
import '../repositories/game_repository.dart';
import 'account_replica.dart';

/// One online game's live session, opened from the replica and written back to
/// it (decision 0013).
///
/// The game opens from the copy the replica holds, straight away and with no
/// network, then the live session takes over. That first value is stale by
/// definition, which is the caller's to show: nothing here pretends otherwise.
///
/// The live session is the same coordinator it always was: one serialized
/// stream, gaps played through in order, duplicates dropped by `seq`, which is
/// why the game screen keeps reading it rather than the replica. What changes is
/// that every session and every recovered frame it applies is stored as it
/// passes, so leaving the game shows a current list, and opening it again with
/// no network shows where it was left.
///
/// The live stream's first snapshot replaces the replica's copy wholesale rather
/// than being ordered against it: the copy may carry a newer header than its
/// frame (a sync can move a game on without serving its board), and a live
/// snapshot at that same revision must still land.
Stream<GameSession> replicatedSessions({
  required AccountReplica replica,
  required GameRepository games,
  required String gameId,
  DateTime Function() clock = DateTime.now,
}) async* {
  final cold = await replica.coldSession(gameId);
  if (cold != null) {
    yield GameSession(snapshot: cold, frame: cold.frame);
    unawaited(replica.markOpened(gameId, now: clock()));
  }
  yield* games.sessions(gameId).asyncMap((session) async {
    await replica.applySession(
      session.snapshot,
      frame: session.frame,
      now: clock(),
    );
    return session;
  });
}
