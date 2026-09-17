import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';

import 'replica_host.dart';

/// Opens the replica as a file in the app's own storage.
Future<ReplicaHost> openReplicaHost({required String name}) async =>
    _FileReplicaHost(driftDatabase(name: name));

final class _FileReplicaHost implements ReplicaHost {
  _FileReplicaHost(this.executor);

  @override
  final QueryExecutor executor;

  @override
  ReplicaStorage get storage => ReplicaStorage.persistent;

  @override
  Future<void> get available => Future.value();

  final _locks = ProcessLocks();

  @override
  Future<void> exclusively(String name, Future<void> Function() body) =>
      _locks.exclusively(name, body);

  @override
  Future<void> requestPersistence() async {}
}
