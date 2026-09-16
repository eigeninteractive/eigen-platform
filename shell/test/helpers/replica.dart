import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_flutter/testing/memory_replica_host.dart';
import 'package:flutter_riverpod/misc.dart' show Override;

/// The device replica in memory, for a test whose screens read it.
///
/// Every list, profile and replay reads the replica now (decision 0013), so a
/// widget test that reaches one needs a database; this is a real one that
/// lives only as long as the test's scope.
List<Override> replicaTestOverrides() => [
  replicaHostProvider.overrideWith((ref) async => MemoryReplicaHost()),
];

/// No replica at all: every account-scoped read answers empty.
///
/// For a widget test that does not exercise stored data. It keeps a database
/// (and the platform channels that open one) out of the test entirely; a test
/// that needs stored data uses [replicaTestOverrides] instead.
List<Override> withoutReplica() => [
  accountReplicaProvider.overrideWith((ref) async => null),
];
