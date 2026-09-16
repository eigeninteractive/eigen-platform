import 'package:eigen_api/eigen_api.dart';

import 'local_game.dart';
import 'local_kernel.dart';

/// Builds the [Session] snapshot a local game presents, so a game screen,
/// replay, history and `buildContent` consume a local game through the
/// existing session path with no game code change (decision 0012).
///
/// [frame] is the human seat's projection at the game's newest version, or null
/// before the start transition.
///
/// Every local-only decision is made here and in `LocalGameStorage`: a local
/// game is private, `local`-origin, unrated, untimed, has no short code, and is
/// exactly as large as its roster.
Session localSession(LocalGame game, {required LocalObservationFrame? frame}) {
  final version = game.version;
  return Session(
    type: SessionTypeEnum.session,
    seq: game.seq,
    gameId: game.id,
    // A short code is the server's handle for sharing a game to join. A local
    // game seats one human and cannot be joined, so it has none, and an empty
    // string is what the wire model can carry.
    shortCode: '',
    access: GameAccess.private,
    origin: GameOrigin.local,
    schemaVersion: game.schemaVersion,
    config: game.config,
    turnSeconds: null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: false,
    ratingPool: null,
    minPlayers: game.roster.length,
    maxPlayers: game.roster.length,
    createdBy: game.createdBy,
    status: game.status,
    players: [for (final seat in game.roster) seat.toSeat()],
    version: version,
    frame: version == null || frame == null
        ? null
        : Frame(
            type: FrameTypeEnum.frame,
            version: version,
            data: frame.data,
            pendingPlayers: frame.pendingPlayers,
            // Untimed, so no deadline and no banks.
            deadline: null,
            playerTimes: null,
            outcomes: game.outcomes,
            // Ratings are a server-side concern and a local game is never rated.
            ratings: null,
          ),
  );
}
