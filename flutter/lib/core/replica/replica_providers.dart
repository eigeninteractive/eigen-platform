import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/replica/replica_host.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'replica_providers.g.dart';

/// The replica database's name on the device.
const replicaDatabaseName = 'eigen_replica';

/// The platform's replica host: how this device or browser opens the database.
///
/// A test overrides this with a host over an in-memory database.
@Riverpod(keepAlive: true)
Future<ReplicaHost> replicaHost(Ref ref) =>
    openReplicaHost(name: replicaDatabaseName);

/// The device's replica database (decision 0013). One connection for the
/// session.
///
/// Fails with [ReplicaUnavailableException] in a browser tab that must not open
/// it because another tab holds it.
@Riverpod(keepAlive: true)
Future<ReplicaDatabase> replicaDatabase(Ref ref) async {
  final executor = (await ref.watch(replicaHostProvider.future)).executor;
  if (executor == null) throw const ReplicaUnavailableException();
  final database = ReplicaDatabase(executor);
  ref.onDispose(database.close);
  return database;
}

/// What the replica's storage turned out to be once opened.
///
/// Reading it opens the database, because a browser only decides its storage
/// when it opens one.
@Riverpod(keepAlive: true)
Future<ReplicaStorage> replicaStorage(Ref ref) async {
  final host = await ref.watch(replicaHostProvider.future);
  if (host.executor == null) return ReplicaStorage.heldElsewhere;
  final database = await ref.watch(replicaDatabaseProvider.future);
  // Any statement opens the connection; this one reads nothing.
  await database.customSelect('SELECT 1').get();
  return host.storage;
}

/// The replica's public reference data: identities, bots, ratings.
@Riverpod(keepAlive: true)
Future<PublicReplica> publicReplica(Ref ref) async =>
    PublicReplica(await ref.watch(replicaDatabaseProvider.future));

/// The signed-in account's replica, or null when nobody is signed in.
@Riverpod(keepAlive: true)
Future<AccountReplica?> accountReplica(Ref ref) async {
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return null;
  return AccountReplica(
    await ref.watch(replicaDatabaseProvider.future),
    userId,
  );
}

/// Where the games this device decides are stored.
@Riverpod(keepAlive: true)
Future<LocalGameStorage> localGameStorage(Ref ref) async =>
    LocalGameStorage(await ref.watch(replicaDatabaseProvider.future));

/// This browser tab may not open the replica: another tab of the app holds it,
/// in a browser where sharing it between tabs is unsafe.
final class ReplicaUnavailableException implements Exception {
  const ReplicaUnavailableException();

  @override
  String toString() => 'The app is open in another tab.';
}
