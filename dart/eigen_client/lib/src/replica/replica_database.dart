import 'package:drift/drift.dart';
// The wire types the generated rows carry. Shown by name: the API also has
// models called Players, Bots and Frames, which are this schema's table names.
import 'package:eigen_api/eigen_api.dart'
    show
        BotType,
        FriendRequestDirectionEnum,
        GameAccess,
        GameOrigin,
        GameStatus,
        Outcome,
        RatingDelta,
        SeatTypeEnum;

import 'converters.dart';
import 'tables.dart';

part 'replica_database.g.dart';

/// The device's database: a replica of the server's read model for every
/// account signed in here, plus the games this device decides (decision 0013).
///
/// Screens read it and nothing else. Three things write it: the sync pass, the
/// open game's live session, and the local engine. This package opens nothing
/// itself; the caller supplies the [QueryExecutor] its platform supports, which
/// is a file on Android and WASM in a browser, and an in-memory database in a
/// test.
@DriftDatabase(
  tables: [
    Accounts,
    Players,
    Bots,
    Games,
    Participants,
    PlayerRatings,
    RatingHistory,
    Relationships,
    Frames,
    LocalGames,
    Transitions,
    CommerceDeliveries,
  ],
)
final class ReplicaDatabase extends _$ReplicaDatabase {
  ReplicaDatabase(super.executor);

  /// Bumped with every schema change, each of which ships a migration step and a
  /// checked schema dump under `drift_schemas/`.
  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    beforeOpen: (details) async {
      // SQLite leaves foreign keys off by default and nothing here declares
      // one, but the replica's writes rely on transactions being real, and a
      // journal mode that survives a crash mid-write.
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );
}
