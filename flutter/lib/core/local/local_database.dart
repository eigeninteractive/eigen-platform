import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

/// The device's own database: the local games played offline, and the JSON
/// snapshots of persisted providers.
///
/// Hand-written rather than generated, and deliberately so. Nothing here is a
/// relational model: a local game is one opaque JSON record the `eigen_client`
/// package owns and versions, and a persisted provider is one JSON string keyed
/// by a name Riverpod chooses. Generating typed columns for a blob and a string
/// would describe neither, while costing a code generator in every consuming
/// app's build. What the tables actually need is stated once, in SQL.
///
/// One database for both, because they share a lifetime and a platform story:
/// native opens a file, the web opens IndexedDB through drift's worker, and
/// neither needs the cross-origin isolation headers that would break the
/// sign-in popup.
class LocalDatabase extends GeneratedDatabase {
  LocalDatabase(super.executor);

  /// Opens the database this platform supports.
  ///
  /// The two web assets are served from the app's own origin, so a consuming
  /// app ships them in `web/`; the scaffold does this for a generated game.
  factory LocalDatabase.open() => LocalDatabase(
    driftDatabase(
      name: 'eigen_local',
      web: DriftWebOptions(
        sqlite3Wasm: Uri.parse('sqlite3.wasm'),
        driftWorker: Uri.parse('drift_worker.js'),
      ),
    ),
  );

  /// No generated tables: every statement in this package is written out.
  @override
  Iterable<TableInfo<Table, dynamic>> get allTables => const [];

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (migrator) async {
      // One row per local game. The record is `LocalGameRecord.toJson()`, whose
      // shape belongs to `eigen_client`; the columns beside it are only what
      // this database is asked to filter and order by, so a change to the
      // record is never a schema change here.
      await customStatement('''
        CREATE TABLE local_games (
          id TEXT NOT NULL PRIMARY KEY,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          record TEXT NOT NULL
        )
      ''');
      await customStatement(
        'CREATE INDEX idx_local_games_user ON local_games (user_id)',
      );
      // Riverpod's persisted provider snapshots: the value plus the two pieces
      // of metadata its expiry and destroy-key rules need.
      await customStatement('''
        CREATE TABLE kv (
          key TEXT NOT NULL PRIMARY KEY,
          value TEXT NOT NULL,
          destroy_key TEXT,
          expire_at INTEGER
        )
      ''');
    },
  );
}
