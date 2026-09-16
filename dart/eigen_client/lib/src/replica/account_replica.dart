import 'package:drift/drift.dart';
import 'package:eigen_api/eigen_api.dart';

import '../api/games_page.dart';
import 'replica_database.dart';

/// Where an account's history stands on this device.
typedef HistoryState = ({
  /// When a sync last completed, or null before the first one.
  DateTime? lastSyncedAt,

  /// Whether older history remains on the server that the device does not
  /// hold. False before the first sync, when nothing is known yet.
  bool hasOlder,
});

/// One account's replica: what its screens read, and what its writers write
/// (decision 0013).
///
/// Every read is a live query answering with the wire's own models, so a screen
/// renders a replicated game exactly as it rendered a fetched one and re-renders
/// whenever a writer changes a row it shows. Every write to a game is ordered by
/// the game's `seq`: an older copy of a game, from any source, changes nothing,
/// and a game this device decides (a local game) is written only by its engine.
final class AccountReplica {
  const AccountReplica(this._db, this.accountId);

  final ReplicaDatabase _db;

  /// The account whose rows this reads and writes: also the signed-in user's
  /// id, which is what "my seat" means below.
  final String accountId;

  static const _inPlay = [
    GameStatus.waiting,
    GameStatus.ready,
    GameStatus.active,
  ];
  static const _ended = [GameStatus.finished, GameStatus.aborted];

  // ── Reads ─────────────────────────────────────────────────────────────────

  /// The account's own profile, or null before its first sync.
  Stream<Profile?> watchProfile() {
    final query = _db.select(_db.accounts).join([
      innerJoin(_db.players, _db.players.id.equalsExp(_db.accounts.id)),
    ])..where(_db.accounts.id.equals(accountId));
    return query.watchSingleOrNull().map((row) {
      if (row == null) return null;
      final account = row.readTable(_db.accounts);
      final player = row.readTable(_db.players);
      return Profile(
        id: player.id,
        username: player.username,
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        isAnonymous: player.isAnonymous,
        email: account.email,
        createdAt: account.createdAt,
      );
    });
  }

  /// When the account last synced, and whether older history remains.
  Stream<HistoryState> watchHistory() =>
      (_db.select(
        _db.accounts,
      )..where((row) => row.id.equals(accountId))).watchSingleOrNull().map(
        (row) => (
          lastSyncedAt: row?.lastSyncedAt == null
              ? null
              : DateTime.fromMillisecondsSinceEpoch(
                  row!.lastSyncedAt!,
                  isUtc: true,
                ),
          hasOlder: row?.historyFloor != null,
        ),
      );

  /// Every game the account holds a seat in that has not ended, the account's
  /// turn first, then the most recently changed.
  Stream<List<GameSummary>> watchActiveGames() =>
      _watchSeated(
        status: _inPlay,
        order: [
          OrderingTerm.desc(_db.games.updatedAt),
          OrderingTerm.desc(_db.games.id),
        ],
      ).asyncMap((games) async {
        bool myTurn(GameSummary game) {
          final seat = game.participants
              .where((p) => p.userId == accountId)
              .map((p) => p.playerIndex)
              .firstOrNull;
          return seat != null && (game.pendingPlayers?.contains(seat) ?? false);
        }

        // Sort is stable only by index, so the secondary key is restated rather
        // than trusted to survive from the query.
        final indexed = games.indexed.toList()
          ..sort((a, b) {
            final aMine = myTurn(a.$2);
            if (aMine != myTurn(b.$2)) return aMine ? -1 : 1;
            return a.$1.compareTo(b.$1);
          });
        return [for (final (_, game) in indexed) game];
      });

  /// The account's ended games, most recently ended first, up to [limit].
  Stream<List<GameSummary>> watchFinishedGames({required int limit}) =>
      _watchSeated(
        status: _ended,
        order: [
          OrderingTerm.desc(
            coalesce([_db.games.finishedAt, _db.games.updatedAt]),
          ),
          OrderingTerm.desc(_db.games.id),
        ],
        limit: limit,
      );

  /// The account's display ratings, best first.
  Stream<List<Rating>> watchRatings() =>
      (_db.select(_db.playerRatings)
            ..where((row) => row.playerId.equals(accountId))
            ..orderBy([(row) => OrderingTerm.desc(row.displayRating)]))
          .watch()
          .map(
            (rows) => [
              for (final row in rows)
                Rating(
                  pool: row.pool,
                  mu: row.mu,
                  sigma: row.sigma,
                  displayRating: row.displayRating,
                  updatedAt: row.updatedAt,
                ),
            ],
          );

  /// Accepted friends, most recent first.
  Stream<List<Friend>> watchFriends() =>
      _watchRelationships(accepted: true).map(
        (rows) => [
          for (final (relationship, player) in rows)
            Friend(
              userId: player.id,
              username: player.username,
              displayName: player.displayName,
              avatarUrl: player.avatarUrl,
              isAnonymous: player.isAnonymous,
              since: relationship.since,
            ),
        ],
      );

  /// Pending requests in both directions, most recent first.
  Stream<List<FriendRequest>> watchFriendRequests() =>
      _watchRelationships(accepted: false).map(
        (rows) => [
          for (final (relationship, player) in rows)
            FriendRequest(
              userId: player.id,
              username: player.username,
              displayName: player.displayName,
              avatarUrl: player.avatarUrl,
              isAnonymous: player.isAnonymous,
              since: relationship.since,
              direction:
                  relationship.direction ??
                  FriendRequestDirectionEnum.unknownDefaultOpenApi,
            ),
        ],
      );

  /// A game as the replica last knew it, labelled nothing: the caller decides
  /// it is stale until something live confirms it.
  ///
  /// The header and roster are the newest copy held; the frame is the newest
  /// the account was served, which a summary alone never carries, so a game the
  /// account has never opened on this device has none.
  Future<Session?> coldSession(String gameId) async {
    final game = await _game(gameId);
    if (game == null) return null;
    final seats = await _seats([gameId]);
    final frame =
        await (_db.select(_db.frames)
              ..where(
                (row) =>
                    row.accountId.equals(accountId) & row.gameId.equals(gameId),
              )
              ..orderBy([(row) => OrderingTerm.desc(row.version)])
              ..limit(1))
            .getSingleOrNull();
    return Session(
      type: SessionTypeEnum.session,
      seq: game.seq,
      gameId: game.id,
      shortCode: game.shortCode,
      access: game.access,
      origin: game.origin,
      schemaVersion: game.schemaVersion,
      config: game.config,
      turnSeconds: game.turnSeconds,
      budgetSeconds: game.budgetSeconds,
      incrementSeconds: game.incrementSeconds,
      rated: game.rated,
      ratingPool: game.ratingPool,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      createdBy: game.createdBy,
      status: game.status,
      players: [
        for (final seat in seats[gameId] ?? const <ParticipantRow>[])
          _seatOf(seat),
      ],
      version: frame?.version,
      frame: frame == null ? null : _frameOf(frame),
    );
  }

  /// Every frame of a game's replay, or null when the replica does not hold all
  /// of them yet.
  Future<List<Frame>?> replayFrames(String gameId) async {
    final game = await _game(gameId);
    if (game == null || !game.framesComplete) return null;
    final rows =
        await (_db.select(_db.frames)
              ..where(
                (row) =>
                    row.accountId.equals(accountId) & row.gameId.equals(gameId),
              )
              ..orderBy([(row) => OrderingTerm.asc(row.version)]))
            .get();
    return [for (final row in rows) _frameOf(row)];
  }

  /// Whether this device decides [gameId]: a local game it holds the log of.
  Future<bool> decidesHere(String gameId) async =>
      await (_db.select(_db.localGames)..where(
            (row) =>
                row.accountId.equals(accountId) & row.gameId.equals(gameId),
          ))
          .getSingleOrNull() !=
      null;

  /// The cursor the next sync asks after, or null when the account has never
  /// synced on this device.
  Future<int?> finishedCursor() async => (await _account())?.finishedCursor;

  /// When the server created the account, as of the last sync.
  Future<int?> createdAt() async => (await _account())?.createdAt;

  /// Where older history continues, or null when none remains or nothing is
  /// known yet.
  Future<String?> historyFloor() async => (await _account())?.historyFloor;

  // ── Writes ────────────────────────────────────────────────────────────────

  /// Applies one sync response in one transaction.
  ///
  /// [first] marks the response to a sync without a cursor, which is the one
  /// that sets where older history continues. The in-play set is whole, so a
  /// game absent from it has ended or been left; but an ended game can arrive on
  /// a later page of the same pass, so [endedSeen] is given only with the last
  /// page, carrying every finished game the pass received, and only then are
  /// absent games removed.
  Future<void> applySync(
    AccountSync sync, {
    required bool first,
    required Set<String>? endedSeen,
    required DateTime now,
  }) => _db.transaction(() async {
    final profile = sync.account;
    await _db
        .into(_db.accounts)
        .insert(
          AccountsCompanion.insert(
            id: accountId,
            email: Value(profile.email),
            createdAt: profile.createdAt,
            finishedCursor: Value(sync.finishedCursor),
            historyFloor: Value(sync.historyFloor),
            lastSyncedAt: Value(now.toUtc().millisecondsSinceEpoch),
          ),
          onConflict: DoUpdate(
            (_) => AccountsCompanion(
              email: Value(profile.email),
              createdAt: Value(profile.createdAt),
              finishedCursor: Value(sync.finishedCursor),
              // Only the response to a first sync says where history continues;
              // an increment leaves the floor where backfill put it.
              historyFloor: first
                  ? Value(sync.historyFloor)
                  : const Value.absent(),
              lastSyncedAt: Value(now.toUtc().millisecondsSinceEpoch),
            ),
          ),
        );

    await _putPlayers([
      Player(
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        isAnonymous: profile.isAnonymous,
      ),
      ...sync.players,
      for (final friend in [
        ...sync.friends,
        ...sync.friendRequests.map(_asFriend),
      ])
        Player(
          id: friend.userId,
          username: friend.username,
          displayName: friend.displayName,
          avatarUrl: friend.avatarUrl,
          isAnonymous: friend.isAnonymous,
        ),
    ]);

    await (_db.delete(
      _db.playerRatings,
    )..where((row) => row.playerId.equals(accountId))).go();
    await (_db.delete(
      _db.relationships,
    )..where((row) => row.accountId.equals(accountId))).go();
    await _db.batch((batch) {
      batch.insertAll(_db.playerRatings, [
        for (final rating in sync.ratings)
          PlayerRatingsCompanion.insert(
            playerId: accountId,
            pool: rating.pool,
            mu: rating.mu.toDouble(),
            sigma: rating.sigma.toDouble(),
            displayRating: rating.displayRating,
            updatedAt: rating.updatedAt,
          ),
      ]);
      batch.insertAll(_db.relationships, [
        for (final friend in sync.friends)
          RelationshipsCompanion.insert(
            accountId: accountId,
            userId: friend.userId,
            accepted: true,
            since: friend.since,
          ),
        for (final request in sync.friendRequests)
          RelationshipsCompanion.insert(
            accountId: accountId,
            userId: request.userId,
            accepted: false,
            direction: Value(request.direction),
            since: request.since,
          ),
      ]);
    });

    for (final game in [...sync.activeGames, ...sync.finishedGames]) {
      await _putSummary(game);
    }
    if (endedSeen != null) {
      await _removeAbsentInPlay({
        ...sync.activeGames.map((game) => game.id),
        ...endedSeen,
      });
    }
  });

  /// Stores a page of older history and moves the floor to where it ended.
  Future<void> applyOlderHistory(GamesPage page) => _db.transaction(() async {
    for (final game in page.games) {
      await _putSummary(game);
    }
    await (_db.update(_db.accounts)..where((row) => row.id.equals(accountId)))
        .write(AccountsCompanion(historyFloor: Value(page.nextCursor)));
  });

  /// Stores a summary the device read outside a sync, such as a game it was
  /// just seated in.
  Future<void> applySummary(GameSummary game) =>
      _db.transaction(() => _putSummary(game));

  /// Stores what a live session stated: the header, the roster, and the frame.
  ///
  /// The frame is stored whatever the header's revision, because a frame is
  /// keyed by its version and a recovered gap arrives beside an older header
  /// on purpose.
  Future<void> applySession(
    Session session, {
    Frame? frame,
    required DateTime now,
  }) => _db.transaction(() async {
    final gameId = session.gameId;
    if (await decidesHere(gameId)) return;
    final at = now.toUtc().millisecondsSinceEpoch;
    final shown = frame ?? session.frame;
    final landed = await _upsertGame(
      GamesCompanion.insert(
        accountId: accountId,
        id: gameId,
        seq: session.seq,
        createdBy: Value(session.createdBy),
        status: session.status,
        access: session.access,
        origin: session.origin,
        schemaVersion: session.schemaVersion,
        config: (session.config as Map).cast<String, dynamic>(),
        turnSeconds: Value(session.turnSeconds),
        budgetSeconds: Value(session.budgetSeconds),
        incrementSeconds: Value(session.incrementSeconds),
        rated: session.rated,
        ratingPool: Value(session.ratingPool),
        minPlayers: session.minPlayers,
        maxPlayers: session.maxPlayers,
        shortCode: session.shortCode,
        // The frame's pending set is this seat's view of it, which is
        // truthful about this seat, the one thing a list derives from it.
        pendingPlayers: session.frame == null
            ? const Value.absent()
            : Value(session.frame!.pendingPlayers),
        turnDeadline: session.frame == null
            ? const Value.absent()
            : Value(session.frame!.deadline),
        outcomes: session.frame?.outcomes == null
            ? const Value.absent()
            : Value(session.frame!.outcomes),
        createdAt: at,
        updatedAt: at,
      ),
      seq: session.seq,
      insertOnly: const {#createdAt},
    );
    if (landed) {
      await _replaceSeats(gameId, session.players);
      if (session.status == GameStatus.finished ||
          session.status == GameStatus.aborted) {
        await (_db.update(_db.games)..where(
              (row) =>
                  row.accountId.equals(accountId) &
                  row.id.equals(gameId) &
                  row.finishedAt.isNull(),
            ))
            .write(GamesCompanion(finishedAt: Value(at)));
      }
    }
    if (shown != null) await _putFrames(gameId, [shown]);
  });

  /// Stores a game's whole replay, and records that the replica now holds all of
  /// it.
  ///
  /// Only for a game the replica already holds. Another player's public game
  /// replayed from their profile is not the account's, and frames with no game
  /// beside them would be kept by nothing and evicted by nothing.
  Future<void> applyReplay(String gameId, List<Frame> frames) =>
      _db.transaction(() async {
        if (await _game(gameId) == null) return;
        await _putFrames(gameId, frames);
        await (_db.update(_db.games)..where(
              (row) => row.accountId.equals(accountId) & row.id.equals(gameId),
            ))
            .write(const GamesCompanion(framesComplete: Value(true)));
      });

  /// Replaces the account's profile with one a profile change answered with.
  Future<void> applyProfile(Profile profile) => _db.transaction(() async {
    await _putPlayers([
      Player(
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        isAnonymous: profile.isAnonymous,
      ),
    ]);
    await (_db.update(_db.accounts)..where((row) => row.id.equals(accountId)))
        .write(AccountsCompanion(email: Value(profile.email)));
  });

  /// Records that the account opened [gameId], which keeps its replay from
  /// being evicted first.
  Future<void> markOpened(String gameId, {required DateTime now}) =>
      (_db.update(_db.games)..where(
            (row) => row.accountId.equals(accountId) & row.id.equals(gameId),
          ))
          .write(
            GamesCompanion(
              lastOpenedAt: Value(now.toUtc().millisecondsSinceEpoch),
            ),
          );

  /// Drops the stored replays of all but the [keep] most recently opened ended
  /// online games. A replay is fetched again when next opened; a local game's
  /// frames are its record and are never dropped.
  Future<void> evictReplays({required int keep}) => _db.transaction(() async {
    final complete =
        await (_db.select(_db.games)
              ..where(
                (row) =>
                    row.accountId.equals(accountId) &
                    row.origin.equalsValue(GameOrigin.online) &
                    row.status.isInValues(_ended) &
                    row.framesComplete.equals(true),
              )
              ..orderBy([
                (row) => OrderingTerm(
                  expression: row.lastOpenedAt,
                  mode: OrderingMode.desc,
                  nulls: NullsOrder.last,
                ),
              ]))
            .get();
    final evicted = [for (final game in complete.skip(keep)) game.id];
    if (evicted.isEmpty) return;
    await (_db.delete(_db.frames)..where(
          (row) => row.accountId.equals(accountId) & row.gameId.isIn(evicted),
        ))
        .go();
    await (_db.update(_db.games)..where(
          (row) => row.accountId.equals(accountId) & row.id.isIn(evicted),
        ))
        .write(const GamesCompanion(framesComplete: Value(false)));
  });

  /// Drops every row the server stated, keeping the games this device decides.
  ///
  /// For an account the server deleted and created again under the same id: its
  /// replicated rows describe an account that no longer exists, but its local
  /// games are the device's own and can still be imported.
  Future<void> resetReplicated() => _db.transaction(() async {
    final decided = _db.selectOnly(_db.localGames)
      ..addColumns([_db.localGames.gameId])
      ..where(_db.localGames.accountId.equals(accountId));
    final ids =
        await (_db.selectOnly(_db.games)
              ..addColumns([_db.games.id])
              ..where(
                _db.games.accountId.equals(accountId) &
                    _db.games.id.isNotInQuery(decided),
              ))
            .map((row) => row.read(_db.games.id)!)
            .get();
    await _forgetGames(ids);
    await (_db.delete(
      _db.ratingHistory,
    )..where((row) => row.accountId.equals(accountId))).go();
    await (_db.delete(
      _db.relationships,
    )..where((row) => row.accountId.equals(accountId))).go();
    await (_db.delete(
      _db.playerRatings,
    )..where((row) => row.playerId.equals(accountId))).go();
    await (_db.delete(
      _db.accounts,
    )..where((row) => row.id.equals(accountId))).go();
  });

  /// Deletes everything the device holds for the account, its local games
  /// included: what deleting the account does.
  Future<void> deleteAll() => _db.transaction(() async {
    for (final table in <TableInfo<Table, Object?>>[
      _db.participants,
      _db.ratingHistory,
      _db.relationships,
      _db.frames,
      _db.localGames,
      _db.transitions,
    ]) {
      await _db.customStatement(
        'DELETE FROM ${table.actualTableName} WHERE account_id = ?',
        [accountId],
      );
    }
    await (_db.delete(
      _db.games,
    )..where((row) => row.accountId.equals(accountId))).go();
    await (_db.delete(
      _db.playerRatings,
    )..where((row) => row.playerId.equals(accountId))).go();
    await (_db.delete(
      _db.accounts,
    )..where((row) => row.id.equals(accountId))).go();
  });

  // ── Internals ─────────────────────────────────────────────────────────────

  Future<AccountRow?> _account() => (_db.select(
    _db.accounts,
  )..where((row) => row.id.equals(accountId))).getSingleOrNull();

  Future<GameRow?> _game(String gameId) =>
      (_db.select(_db.games)..where(
            (row) => row.accountId.equals(accountId) & row.id.equals(gameId),
          ))
          .getSingleOrNull();

  /// The account's games in [status] where it holds a seat, assembled with
  /// their rosters and rating changes, re-read whenever a game row changes.
  ///
  /// Watching the game rows is enough: a roster or rating change is always
  /// written in the same transaction as its game's row.
  Stream<List<GameSummary>> _watchSeated({
    required List<GameStatus> status,
    required List<OrderingTerm> order,
    int? limit,
  }) {
    final seated = _db.selectOnly(_db.participants)
      ..addColumns([_db.participants.gameId])
      ..where(
        _db.participants.accountId.equals(accountId) &
            _db.participants.userId.equals(accountId),
      );
    final query = _db.select(_db.games)
      ..where(
        (row) =>
            row.accountId.equals(accountId) &
            row.status.isInValues(status) &
            row.id.isInQuery(seated),
      )
      ..orderBy([for (final term in order) (_) => term]);
    if (limit != null) query.limit(limit);
    return query.watch().asyncMap(_assemble);
  }

  Future<List<GameSummary>> _assemble(List<GameRow> games) async {
    if (games.isEmpty) return const [];
    final ids = [for (final game in games) game.id];
    final seats = await _seats(ids);
    final ratings =
        await (_db.select(_db.ratingHistory)..where(
              (row) => row.accountId.equals(accountId) & row.gameId.isIn(ids),
            ))
            .get();
    final ratingsByGame = <String, List<RatingDelta>>{};
    for (final row in ratings) {
      (ratingsByGame[row.gameId] ??= []).add(
        RatingDelta(
          identity: RatingIdentity(userId: row.userId, botId: row.botId),
          pool: row.pool,
          muBefore: row.muBefore,
          sigmaBefore: row.sigmaBefore,
          displayBefore: row.displayBefore,
          muAfter: row.muAfter,
          sigmaAfter: row.sigmaAfter,
          displayAfter: row.displayAfter,
          displayChange: row.displayChange,
        ),
      );
    }
    return [
      for (final game in games)
        GameSummary(
          id: game.id,
          seq: game.seq,
          createdBy: game.createdBy,
          status: game.status,
          access: game.access,
          origin: game.origin,
          schemaVersion: game.schemaVersion,
          config: game.config,
          turnSeconds: game.turnSeconds,
          budgetSeconds: game.budgetSeconds,
          incrementSeconds: game.incrementSeconds,
          rated: game.rated,
          ratingPool: game.ratingPool,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          shortCode: game.shortCode,
          pendingPlayers: game.pendingPlayers,
          turnDeadline: game.turnDeadline,
          outcomes: game.outcomes,
          ratings: ratingsByGame[game.id],
          finishedAt: game.finishedAt,
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
          participants: [
            for (final seat in seats[game.id] ?? const <ParticipantRow>[])
              _seatOf(seat),
          ],
        ),
    ];
  }

  Future<Map<String, List<ParticipantRow>>> _seats(List<String> gameIds) async {
    final rows =
        await (_db.select(_db.participants)
              ..where(
                (row) =>
                    row.accountId.equals(accountId) & row.gameId.isIn(gameIds),
              )
              ..orderBy([(row) => OrderingTerm.asc(row.playerIndex)]))
            .get();
    final byGame = <String, List<ParticipantRow>>{};
    for (final row in rows) {
      (byGame[row.gameId] ??= []).add(row);
    }
    return byGame;
  }

  Stream<List<(RelationshipRow, PlayerRow)>> _watchRelationships({
    required bool accepted,
  }) {
    final query =
        _db.select(_db.relationships).join([
            innerJoin(
              _db.players,
              _db.players.id.equalsExp(_db.relationships.userId),
            ),
          ])
          ..where(
            _db.relationships.accountId.equals(accountId) &
                _db.relationships.accepted.equals(accepted),
          )
          ..orderBy([OrderingTerm.desc(_db.relationships.since)]);
    return query.watch().map(
      (rows) => [
        for (final row in rows)
          (row.readTable(_db.relationships), row.readTable(_db.players)),
      ],
    );
  }

  /// Stores one summary: the row under its revision guard, and, only when the
  /// row now holds this revision, the roster and rating changes beside it.
  Future<void> _putSummary(GameSummary game) async {
    if (await decidesHere(game.id)) return;
    final landed = await _upsertGame(
      GamesCompanion.insert(
        accountId: accountId,
        id: game.id,
        seq: game.seq,
        createdBy: Value(game.createdBy),
        status: game.status,
        access: game.access,
        origin: game.origin,
        schemaVersion: game.schemaVersion,
        config: (game.config as Map).cast<String, dynamic>(),
        turnSeconds: Value(game.turnSeconds),
        budgetSeconds: Value(game.budgetSeconds),
        incrementSeconds: Value(game.incrementSeconds),
        rated: game.rated,
        ratingPool: Value(game.ratingPool),
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        shortCode: game.shortCode,
        pendingPlayers: Value(game.pendingPlayers),
        turnDeadline: Value(game.turnDeadline),
        outcomes: Value(game.outcomes),
        finishedAt: Value(game.finishedAt),
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
      ),
      seq: game.seq,
    );
    if (!landed) return;
    await _replaceSeats(game.id, game.participants);
    final ratings = game.ratings;
    if (ratings == null) return;
    await (_db.delete(_db.ratingHistory)..where(
          (row) => row.accountId.equals(accountId) & row.gameId.equals(game.id),
        ))
        .go();
    await _db.batch((batch) {
      batch.insertAll(_db.ratingHistory, [
        for (final delta in ratings)
          RatingHistoryCompanion.insert(
            accountId: accountId,
            gameId: game.id,
            identity: delta.identity.userId != null
                ? 'u:${delta.identity.userId}'
                : 'b:${delta.identity.botId}',
            userId: Value(delta.identity.userId),
            botId: Value(delta.identity.botId),
            pool: delta.pool,
            muBefore: delta.muBefore.toDouble(),
            sigmaBefore: delta.sigmaBefore.toDouble(),
            displayBefore: delta.displayBefore,
            muAfter: delta.muAfter.toDouble(),
            sigmaAfter: delta.sigmaAfter.toDouble(),
            displayAfter: delta.displayAfter,
            displayChange: delta.displayChange,
          ),
      ]);
    });
  }

  /// Inserts or updates a game row unless the stored copy is newer, and answers
  /// whether the row now holds this revision. [insertOnly] names columns an
  /// update must leave as they are.
  Future<bool> _upsertGame(
    GamesCompanion row, {
    required int seq,
    Set<Symbol> insertOnly = const {},
  }) async {
    final update = insertOnly.contains(#createdAt)
        ? row.copyWith(createdAt: const Value.absent())
        : row;
    await _db
        .into(_db.games)
        .insert(
          row,
          onConflict: DoUpdate(
            (_) => update,
            target: [_db.games.accountId, _db.games.id],
            where: (old) => old.seq.isSmallerOrEqualValue(seq),
          ),
        );
    return (await _game(row.id.value))?.seq == seq;
  }

  Future<void> _replaceSeats(String gameId, List<Seat> seats) async {
    await (_db.delete(_db.participants)..where(
          (row) => row.accountId.equals(accountId) & row.gameId.equals(gameId),
        ))
        .go();
    await _db.batch((batch) {
      batch.insertAll(_db.participants, [
        for (final seat in seats)
          ParticipantsCompanion.insert(
            accountId: accountId,
            gameId: gameId,
            playerIndex: seat.playerIndex,
            userId: Value(seat.userId),
            botId: Value(seat.botId),
            type: seat.type,
          ),
      ]);
    });
  }

  Future<void> _putFrames(String gameId, List<Frame> frames) =>
      _db.batch((batch) {
        batch.insertAllOnConflictUpdate(_db.frames, [
          for (final frame in frames)
            FramesCompanion.insert(
              accountId: accountId,
              gameId: gameId,
              version: frame.version,
              data: (frame.data as Map).cast<String, dynamic>(),
              pendingPlayers: frame.pendingPlayers,
              deadline: Value(frame.deadline),
              playerTimes: Value(frame.playerTimes),
              outcomes: Value(frame.outcomes),
              ratings: Value(frame.ratings),
            ),
        ]);
      });

  Future<void> _putPlayers(List<Player> players) => _db.batch((batch) {
    batch.insertAllOnConflictUpdate(_db.players, [
      for (final player in players)
        PlayersCompanion.insert(
          id: player.id,
          username: player.username,
          displayName: player.displayName,
          avatarUrl: Value(player.avatarUrl),
          isAnonymous: player.isAnonymous,
        ),
    ]);
  });

  /// Removes the account's in-play online games not in [kept]: ended, or left.
  Future<void> _removeAbsentInPlay(Set<String> kept) async {
    final decided = _db.selectOnly(_db.localGames)
      ..addColumns([_db.localGames.gameId])
      ..where(_db.localGames.accountId.equals(accountId));
    final absent =
        await (_db.selectOnly(_db.games)
              ..addColumns([_db.games.id])
              ..where(
                _db.games.accountId.equals(accountId) &
                    _db.games.status.isInValues(_inPlay) &
                    _db.games.id.isNotIn(kept) &
                    _db.games.id.isNotInQuery(decided),
              ))
            .map((row) => row.read(_db.games.id)!)
            .get();
    await _forgetGames(absent);
  }

  Future<void> _forgetGames(List<String> ids) async {
    if (ids.isEmpty) return;
    await (_db.delete(_db.frames)..where(
          (row) => row.accountId.equals(accountId) & row.gameId.isIn(ids),
        ))
        .go();
    await (_db.delete(_db.participants)..where(
          (row) => row.accountId.equals(accountId) & row.gameId.isIn(ids),
        ))
        .go();
    await (_db.delete(_db.ratingHistory)..where(
          (row) => row.accountId.equals(accountId) & row.gameId.isIn(ids),
        ))
        .go();
    await (_db.delete(
      _db.games,
    )..where((row) => row.accountId.equals(accountId) & row.id.isIn(ids))).go();
  }

  Seat _seatOf(ParticipantRow row) => Seat(
    playerIndex: row.playerIndex,
    userId: row.userId,
    botId: row.botId,
    type: row.type,
  );

  Frame _frameOf(FrameRow row) => Frame(
    type: FrameTypeEnum.frame,
    version: row.version,
    data: row.data,
    pendingPlayers: row.pendingPlayers,
    deadline: row.deadline,
    playerTimes: row.playerTimes,
    outcomes: row.outcomes,
    ratings: row.ratings,
  );

  Friend _asFriend(FriendRequest request) => Friend(
    userId: request.userId,
    username: request.username,
    displayName: request.displayName,
    avatarUrl: request.avatarUrl,
    isAnonymous: request.isAnonymous,
    since: request.since,
  );
}
