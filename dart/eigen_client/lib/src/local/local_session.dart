import 'package:eigen_api/eigen_api.dart';

import 'local_game.dart';

/// Builds the [Session] snapshot a local game presents, so a game screen,
/// replay, history and `buildContent` consume a local game through the
/// existing session path with no game code change (decision 0012).
///
/// Every local-only decision is made here and only here: a local game is
/// private, `local`-origin, unrated, untimed, has no short code, and is exactly
/// as large as its roster. One file states them, so a new wire field is one
/// line rather than a search.
Session localSession(LocalGameRecord record, {required int playerIndex}) {
  final version = record.version;
  return Session(
    type: SessionTypeEnum.session,
    seq: record.seq,
    gameId: record.id,
    // A short code is the server's handle for sharing a game to join. A local
    // game seats one human and cannot be joined, so it has none, and an empty
    // string is what the wire model can carry.
    shortCode: '',
    access: GameAccess.private,
    origin: GameOrigin.local,
    schemaVersion: record.schemaVersion,
    config: record.config,
    turnSeconds: null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: false,
    ratingPool: null,
    minPlayers: record.roster.length,
    maxPlayers: record.roster.length,
    createdBy: record.createdBy,
    status: record.status,
    players: [for (final seat in record.roster) seat.toSeat()],
    version: version,
    frame: version == null
        ? null
        : localFrame(record, playerIndex: playerIndex, version: version),
  );
}

/// One seat's [Frame] at [version], or null when that seat has no projection
/// there (a seat nobody holds).
///
/// The deadline and the banks are null because a local game is untimed, and
/// the outcomes ride the finishing frame exactly as the server's do.
Frame? localFrame(
  LocalGameRecord record, {
  required int playerIndex,
  required int version,
}) {
  final frame = record.frameFor(seat: playerIndex, version: version);
  if (frame == null) return null;
  final isFinal = record.version == version;
  return Frame(
    type: FrameTypeEnum.frame,
    version: version,
    data: frame.data,
    pendingPlayers: frame.pendingPlayers,
    deadline: null,
    playerTimes: null,
    outcomes: isFinal ? record.outcomes : null,
    // Ratings are a server-side concern and a local game is never rated.
    ratings: null,
  );
}
