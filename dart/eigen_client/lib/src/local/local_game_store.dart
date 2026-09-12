import 'local_game.dart';

/// Where local games live between sessions: the port the Flutter adapter
/// implements with Drift on native and on the web (decision 0012).
///
/// Records are scoped by the owning user id: they survive sign-out, are listed
/// for whoever is signed in, and are deleted with the account. Nothing here
/// knows about a database, which is what keeps this package pure Dart and lets
/// a test run the whole engine against [InMemoryLocalGameStore].
abstract interface class LocalGameStore {
  /// Every record [userId] created, in no guaranteed order; the caller sorts
  /// for display.
  Future<List<LocalGameRecord>> list(String userId);

  /// One record by game id, or null when this device holds none. A local-origin
  /// game the device has never played is pulled from the server instead.
  Future<LocalGameRecord?> load(String id);

  /// Writes a record, replacing any earlier copy of the same id. The engine
  /// calls this after every commit, so a crash costs at most the move in
  /// flight.
  Future<void> save(LocalGameRecord record);

  /// Removes a record permanently.
  Future<void> delete(String id);
}

/// A [LocalGameStore] held in memory: what tests and previews run on.
///
/// Deliberately not a cache in front of anything. It is the whole store, so a
/// test exercises the same save-after-every-commit path the device does.
final class InMemoryLocalGameStore implements LocalGameStore {
  final Map<String, LocalGameRecord> _records = {};

  /// How many times [save] has been called, which is what a test asserts
  /// persistence with.
  int saves = 0;

  @override
  Future<List<LocalGameRecord>> list(String userId) async => [
    for (final record in _records.values)
      if (record.createdBy == userId) record,
  ];

  @override
  Future<LocalGameRecord?> load(String id) async => _records[id];

  @override
  Future<void> save(LocalGameRecord record) async {
    saves++;
    _records[record.id] = record;
  }

  @override
  Future<void> delete(String id) async {
    _records.remove(id);
  }
}
