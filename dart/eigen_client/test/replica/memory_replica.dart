import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

/// A replica database in memory, closed when the test ends.
///
/// The real schema on a real SQLite: a test exercises the same statements, the
/// same revision guards and the same transactions a device runs.
ReplicaDatabase memoryReplica() {
  // Every test opens its own database on purpose.
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  final db = ReplicaDatabase(NativeDatabase.memory());
  addTearDown(db.close);
  return db;
}
