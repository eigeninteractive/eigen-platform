import 'package:drift/drift.dart';
import 'package:eigen_api/eigen_api.dart';

import 'replica_database.dart';

/// The replica's public reference data: identities, the bot catalog, and
/// display ratings. Shared by every account on the device, because none of it
/// belongs to one (decision 0013).
final class PublicReplica {
  const PublicReplica(this._db);

  final ReplicaDatabase _db;

  /// One human's public identity, as the device last learned it.
  Stream<Player?> watchPlayer(String id) =>
      (_db.select(_db.players)..where((row) => row.id.equals(id)))
          .watchSingleOrNull()
          .map((row) => row == null ? null : playerOf(row));

  /// The ids among [ids] the device holds no identity for.
  Future<Set<String>> missingPlayers(Iterable<String> ids) async {
    final wanted = ids.toSet();
    if (wanted.isEmpty) return const {};
    final held =
        await (_db.selectOnly(_db.players)
              ..addColumns([_db.players.id])
              ..where(_db.players.id.isIn(wanted)))
            .map((row) => row.read(_db.players.id)!)
            .get();
    return wanted.difference(held.toSet());
  }

  /// Stores identities the server stated, replacing what was held for them.
  Future<void> applyPlayers(Iterable<Player> players) => _db.batch((batch) {
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

  /// Forgets identities the server no longer has: how a deleted account's name
  /// and avatar leave this device (decision 0007).
  Future<void> removePlayers(Iterable<String> ids) =>
      (_db.delete(_db.players)..where((row) => row.id.isIn(ids))).go();

  /// The bot catalog.
  Stream<List<Bot>> watchBots() => _db
      .select(_db.bots)
      .watch()
      .map((rows) => [for (final row in rows) botOf(row)]);

  /// The bot catalog, once.
  Future<List<Bot>> bots() async => [
    for (final row in await _db.select(_db.bots).get()) botOf(row),
  ];

  /// Replaces the catalog with [bots]: the server states it whole, so a bot it
  /// no longer lists is gone.
  Future<void> applyBots(List<Bot> bots) => _db.transaction(() async {
    await _db.delete(_db.bots).go();
    await _db.batch((batch) {
      batch.insertAll(_db.bots, [
        for (final bot in bots)
          BotsCompanion.insert(
            id: bot.id,
            username: bot.username,
            displayName: bot.displayName,
            avatarUrl: Value(bot.avatarUrl),
            schemaVersion: bot.schemaVersion,
            type: bot.type,
            ratedEligible: bot.ratedEligible,
            config: (bot.config as Map).cast<String, dynamic>(),
            tier: bot.tier,
          ),
      ]);
    });
  });

  /// One identity's display ratings, best first.
  Stream<List<Rating>> watchRatings(String playerId) =>
      (_db.select(_db.playerRatings)
            ..where((row) => row.playerId.equals(playerId))
            ..orderBy([(row) => OrderingTerm.desc(row.displayRating)]))
          .watch()
          .map((rows) => [for (final row in rows) ratingOf(row)]);

  /// Replaces one identity's ratings with what the server stated.
  Future<void> applyRatings(String playerId, List<Rating> ratings) =>
      _db.transaction(() async {
        await (_db.delete(
          _db.playerRatings,
        )..where((row) => row.playerId.equals(playerId))).go();
        await _db.batch((batch) {
          batch.insertAll(_db.playerRatings, [
            for (final rating in ratings)
              PlayerRatingsCompanion.insert(
                playerId: playerId,
                pool: rating.pool,
                mu: rating.mu.toDouble(),
                sigma: rating.sigma.toDouble(),
                displayRating: rating.displayRating,
                updatedAt: rating.updatedAt,
              ),
          ]);
        });
      });
}

/// A stored identity as the wire states it.
Player playerOf(PlayerRow row) => Player(
  id: row.id,
  username: row.username,
  displayName: row.displayName,
  avatarUrl: row.avatarUrl,
  isAnonymous: row.isAnonymous,
);

/// A stored catalog row as the wire states it.
Bot botOf(BotRow row) => Bot(
  id: row.id,
  username: row.username,
  displayName: row.displayName,
  avatarUrl: row.avatarUrl,
  schemaVersion: row.schemaVersion,
  type: row.type,
  ratedEligible: row.ratedEligible,
  config: row.config,
  tier: row.tier,
);

/// A stored rating as the wire states it.
Rating ratingOf(PlayerRatingRow row) => Rating(
  pool: row.pool,
  mu: row.mu,
  sigma: row.sigma,
  displayRating: row.displayRating,
  updatedAt: row.updatedAt,
);
