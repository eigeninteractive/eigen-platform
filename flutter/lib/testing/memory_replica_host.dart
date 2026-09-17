import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:eigen_flutter/core/replica/replica_host.dart';

/// A [ReplicaHost] over an in-memory database, for tests.
///
/// The real schema on a real SQLite, so a test exercises the same statements
/// and transactions a device runs. Override `replicaHostProvider` with one:
///
/// ```dart
/// replicaHostProvider.overrideWith((ref) async => MemoryReplicaHost()),
/// ```
final class MemoryReplicaHost implements ReplicaHost {
  MemoryReplicaHost({
    this.storageMode = ReplicaStorage.persistent,
    this.persistenceMode = StoragePersistence.granted,
  }) {
    // A test opens a database per case on purpose.
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  }

  /// What [storage] reports, so a test can stand in for a browser that keeps
  /// nothing.
  final ReplicaStorage storageMode;

  /// What [persistence] reports, so a test can stand in for a browser that has
  /// not been asked to keep this site's storage.
  final StoragePersistence persistenceMode;

  /// Whether [requestPersistence] was called.
  var persistenceRequested = false;

  @override
  final QueryExecutor executor = NativeDatabase.memory();

  @override
  ReplicaStorage get storage => storageMode;

  @override
  Future<void> get available => Future.value();

  final _locks = ProcessLocks();

  @override
  Future<void> exclusively(String name, Future<void> Function() body) =>
      _locks.exclusively(name, body);

  @override
  Stream<bool> get answering => Stream.value(true);

  @override
  Future<StoragePersistence> persistence() async => persistenceMode;

  @override
  Future<StoragePersistence> requestPersistence() async {
    persistenceRequested = true;
    return persistenceMode == StoragePersistence.askable
        ? StoragePersistence.granted
        : persistenceMode;
  }
}
