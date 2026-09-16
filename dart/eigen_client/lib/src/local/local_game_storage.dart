import 'package:drift/drift.dart';
import 'package:eigen_api/eigen_api.dart';

import '../replica/replica_database.dart';
import 'local_game.dart';
import 'local_kernel.dart';

/// A local game pulled back from the server, ready to be written in place of
/// whatever this device held under its id.
typedef RebuiltLocalGame = ({
  LocalGame game,
  List<LocalGameTransition> transitions,

  /// The human seat's frame at every version, oldest first.
  List<LocalObservationFrame> frames,
});

/// Where the games this device decides live: rows in the replica, the same
/// tables every other game is in (decision 0013).
///
/// A local game is a `games` row and its `participants`, like any game, plus
/// `local_games` for what only a device-decided game has (its seed and how far
/// it has synchronized), `transitions` for its authoritative log, and `frames`
/// for what its one human saw. The lists, the replay, and the history therefore
/// read a local game exactly as they read an online one, and nothing merges the
/// two.
///
/// Writes are transactions shaped like the Durable Object's commit, which the
/// device can make atomic across the object's log and D1's summary where the
/// server cannot.
final class LocalGameStorage {
  const LocalGameStorage(this._db);

  final ReplicaDatabase _db;

  /// The game [accountId] decides under [gameId], or null when this device
  /// decides no such game: an online game, or a local one another device played
  /// that has not been pulled here.
  Future<LocalGame?> load({
    required String accountId,
    required String gameId,
  }) async {
    final local =
        await (_db.select(_db.localGames)..where(
              (row) =>
                  row.accountId.equals(accountId) & row.gameId.equals(gameId),
            ))
            .getSingleOrNull();
    if (local == null) return null;
    final game =
        await (_db.select(_db.games)..where(
              (row) => row.accountId.equals(accountId) & row.id.equals(gameId),
            ))
            .getSingle();
    final seats =
        await (_db.select(_db.participants)
              ..where(
                (row) =>
                    row.accountId.equals(accountId) & row.gameId.equals(gameId),
              )
              ..orderBy([(row) => OrderingTerm.asc(row.playerIndex)]))
            .get();
    final latest =
        await (_db.select(_db.transitions)
              ..where(
                (row) =>
                    row.accountId.equals(accountId) & row.gameId.equals(gameId),
              )
              ..orderBy([(row) => OrderingTerm.desc(row.version)])
              ..limit(1))
            .getSingleOrNull();
    return _gameOf(game, seats, local, latest);
  }

  /// Every game [accountId] decides whose log the server does not fully hold.
  /// A diverged game is never among them: its unsent moves are the ones the
  /// server refused.
  Future<List<LocalGame>> unsynced(String accountId) async {
    final rows =
        await (_db.select(_db.localGames)..where(
              (row) =>
                  row.accountId.equals(accountId) & row.diverged.equals(false),
            ))
            .get();
    final games = <LocalGame>[];
    for (final row in rows) {
      final game = await load(accountId: accountId, gameId: row.gameId);
      if (game != null && game.needsSync) games.add(game);
    }
    return games;
  }

  /// Writes a new game and its opening transition.
  Future<void> create(
    LocalGame game, {
    required LocalGameTransition opening,
    required LocalObservationFrame humanFrame,
    required DateTime now,
  }) => _db.transaction(() async {
    await _writeGame(game, now: now);
    await _db.batch((batch) {
      batch.insertAll(_db.participants, [
        for (final seat in game.roster) _participant(game, seat),
      ]);
      batch.insert(
        _db.localGames,
        LocalGamesCompanion.insert(
          accountId: game.createdBy,
          gameId: game.id,
          seed: game.seed,
          remoteCreated: game.remoteCreated,
          syncedVersion: game.syncedVersion,
          diverged: game.diverged,
        ),
      );
      batch.insert(_db.transitions, _transition(game, opening));
      batch.insert(_db.frames, _frame(game, humanFrame, opening.version));
    });
  });

  /// Commits one transition: appends it and the human's frame, and moves the
  /// game's row to where the transition left it.
  Future<void> commit(
    LocalGame game, {
    required LocalGameTransition transition,
    required LocalObservationFrame humanFrame,
    required DateTime now,
  }) => _db.transaction(() async {
    await _writeGame(game, now: now);
    await _db.batch((batch) {
      batch.insert(_db.transitions, _transition(game, transition));
      batch.insert(_db.frames, _frame(game, humanFrame, transition.version));
    });
  });

  /// Up to [limit] logged transitions after [afterVersion], oldest first: the
  /// next page to upload.
  Future<List<LocalGameTransition>> transitionsAfter({
    required String accountId,
    required String gameId,
    required int afterVersion,
    required int limit,
  }) async {
    final rows =
        await (_db.select(_db.transitions)
              ..where(
                (row) =>
                    row.accountId.equals(accountId) &
                    row.gameId.equals(gameId) &
                    row.version.isBiggerThanValue(afterVersion),
              )
              ..orderBy([(row) => OrderingTerm.asc(row.version)])
              ..limit(limit))
            .get();
    return [for (final row in rows) _transitionOf(row)];
  }

  /// The raw state this device committed at [version], or null when its log
  /// holds no such version.
  Future<Map<String, dynamic>?> stateAt({
    required String accountId,
    required String gameId,
    required int version,
  }) async {
    final row =
        await (_db.select(_db.transitions)..where(
              (row) =>
                  row.accountId.equals(accountId) &
                  row.gameId.equals(gameId) &
                  row.version.equals(version),
            ))
            .getSingleOrNull();
    return row?.state;
  }

  /// Records what synchronization learned, touching only the fields it owns.
  ///
  /// A field-level update rather than a rewrite of the game, so a move the
  /// engine commits while a sync pass is running is never overwritten by the
  /// snapshot the pass started from. [status] is the one game field a pass may
  /// set: the terminal status the server reached, such as an abandoned-game
  /// reap.
  Future<LocalGame> mark({
    required String accountId,
    required String gameId,
    bool? remoteCreated,
    int? syncedVersion,
    bool? diverged,
    GameStatus? status,
    DateTime? now,
  }) async {
    await _db.transaction(() async {
      await (_db.update(_db.localGames)..where(
            (row) =>
                row.accountId.equals(accountId) & row.gameId.equals(gameId),
          ))
          .write(
            LocalGamesCompanion(
              remoteCreated: Value.absentIfNull(remoteCreated),
              syncedVersion: Value.absentIfNull(syncedVersion),
              diverged: Value.absentIfNull(diverged),
            ),
          );
      if (status != null) {
        await (_db.update(_db.games)..where(
              (row) => row.accountId.equals(accountId) & row.id.equals(gameId),
            ))
            .write(
              GamesCompanion(
                status: Value(status),
                updatedAt: Value(
                  (now ?? DateTime.now()).toUtc().millisecondsSinceEpoch,
                ),
              ),
            );
      }
    });
    final game = await load(accountId: accountId, gameId: gameId);
    if (game == null) throw StateError('Local game $gameId vanished mid-sync');
    return game;
  }

  /// Replaces whatever this device holds under the rebuilt game's id with the
  /// server's copy of it: how a game played on another device, or one whose
  /// unsent moves diverged, becomes playable here.
  Future<void> replace(RebuiltLocalGame rebuilt, {required DateTime now}) {
    final game = rebuilt.game;
    return _db.transaction(() async {
      await forget(accountId: game.createdBy, gameId: game.id);
      await _writeGame(game, now: now);
      await _db.batch((batch) {
        batch.insertAll(_db.participants, [
          for (final seat in game.roster) _participant(game, seat),
        ]);
        batch.insert(
          _db.localGames,
          LocalGamesCompanion.insert(
            accountId: game.createdBy,
            gameId: game.id,
            seed: game.seed,
            remoteCreated: game.remoteCreated,
            syncedVersion: game.syncedVersion,
            diverged: game.diverged,
          ),
        );
        batch.insertAll(_db.transitions, [
          for (final transition in rebuilt.transitions)
            _transition(game, transition),
        ]);
        for (final (index, frame) in rebuilt.frames.indexed) {
          batch.insert(
            _db.frames,
            _frame(game, frame, rebuilt.transitions[index].version),
          );
        }
      });
    });
  }

  /// Removes everything held for one game.
  Future<void> forget({required String accountId, required String gameId}) =>
      _db.transaction(() async {
        await (_db.delete(_db.transitions)..where(
              (row) =>
                  row.accountId.equals(accountId) & row.gameId.equals(gameId),
            ))
            .go();
        await (_db.delete(_db.frames)..where(
              (row) =>
                  row.accountId.equals(accountId) & row.gameId.equals(gameId),
            ))
            .go();
        await (_db.delete(_db.localGames)..where(
              (row) =>
                  row.accountId.equals(accountId) & row.gameId.equals(gameId),
            ))
            .go();
        await (_db.delete(_db.participants)..where(
              (row) =>
                  row.accountId.equals(accountId) & row.gameId.equals(gameId),
            ))
            .go();
        await (_db.delete(_db.games)..where(
              (row) => row.accountId.equals(accountId) & row.id.equals(gameId),
            ))
            .go();
      });

  Future<void> _writeGame(LocalGame game, {required DateTime now}) => _db
      .into(_db.games)
      .insertOnConflictUpdate(
        GamesCompanion.insert(
          accountId: game.createdBy,
          id: game.id,
          seq: game.seq,
          createdBy: Value(game.createdBy),
          status: game.status,
          // Every local-only value is fixed here and in `localSession`: a
          // local game is private, unrated, untimed, as large as its roster,
          // and has no code to share because nobody can join it.
          access: GameAccess.private,
          origin: GameOrigin.local,
          schemaVersion: game.schemaVersion,
          config: game.config,
          rated: false,
          minPlayers: game.roster.length,
          maxPlayers: game.roster.length,
          shortCode: '',
          pendingPlayers: Value(game.latest?.pending),
          outcomes: Value(game.outcomes),
          finishedAt: Value(game.finishedAt?.toUtc().millisecondsSinceEpoch),
          createdAt: game.createdAt.toUtc().millisecondsSinceEpoch,
          updatedAt: now.toUtc().millisecondsSinceEpoch,
          // Every version's frame is written as it commits.
          framesComplete: const Value(true),
        ),
      );

  ParticipantsCompanion _participant(LocalGame game, LocalSeat seat) =>
      ParticipantsCompanion.insert(
        accountId: game.createdBy,
        gameId: game.id,
        playerIndex: seat.playerIndex,
        userId: Value(seat.userId),
        botId: Value(seat.botId),
        type: seat.type,
      );

  TransitionsCompanion _transition(
    LocalGame game,
    LocalGameTransition transition,
  ) => TransitionsCompanion.insert(
    accountId: game.createdBy,
    gameId: game.id,
    version: transition.version,
    state: transition.state,
    action: Value(transition.action?.toJson()),
    pending: transition.pending,
  );

  /// The human's frame. Outcomes ride the frame that ended the game, exactly as
  /// the server's finishing frame carries them.
  FramesCompanion _frame(
    LocalGame game,
    LocalObservationFrame frame,
    int version,
  ) => FramesCompanion.insert(
    accountId: game.createdBy,
    gameId: game.id,
    version: version,
    data: frame.data,
    pendingPlayers: frame.pendingPlayers,
    outcomes: Value(version == game.version ? game.outcomes : null),
  );

  LocalGame _gameOf(
    GameRow game,
    List<ParticipantRow> seats,
    LocalGameRow local,
    TransitionRow? latest,
  ) => LocalGame(
    id: game.id,
    createdBy: local.accountId,
    createdAt: DateTime.fromMillisecondsSinceEpoch(game.createdAt, isUtc: true),
    schemaVersion: game.schemaVersion,
    config: game.config,
    seed: local.seed,
    roster: [
      for (final seat in seats)
        LocalSeat(
          playerIndex: seat.playerIndex,
          userId: seat.userId,
          botId: seat.botId,
          type: seat.type,
        ),
    ],
    status: game.status,
    seq: game.seq,
    latest: latest == null ? null : _transitionOf(latest),
    outcomes: game.outcomes,
    finishedAt: game.finishedAt == null
        ? null
        : DateTime.fromMillisecondsSinceEpoch(game.finishedAt!, isUtc: true),
    syncedVersion: local.syncedVersion,
    remoteCreated: local.remoteCreated,
    diverged: local.diverged,
  );

  LocalGameTransition _transitionOf(TransitionRow row) => LocalGameTransition(
    version: row.version,
    state: row.state,
    action: row.action == null
        ? null
        : LocalTransitionAction.fromJson(row.action!),
    pending: row.pending,
  );
}
