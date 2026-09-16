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
  MemoryReplicaHost({this.storageMode = ReplicaStorage.persistent}) {
    // A test opens a database per case on purpose.
    driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  }

  /// What [storage] reports, so a test can stand in for a browser that keeps
  /// nothing.
  final ReplicaStorage storageMode;

  @override
  final QueryExecutor executor = NativeDatabase.memory();

  @override
  Future<ReplicaStorage> get storage async => storageMode;

  @override
  Future<void> exclusively(String name, Future<void> Function() body) =>
      body();

  @override
  Future<void> requestPersistence() async {}
}
