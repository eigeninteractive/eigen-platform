import 'package:eigen_flutter/core/local/local_database.dart';
import 'package:eigen_flutter/core/storage/storage_backend.dart';
import 'package:flutter_riverpod/experimental/persist.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'storage_provider.g.dart';

/// Whether API snapshots persist across application launches.
///
/// True on every platform now. The browser used to be the exception, which was
/// tolerable while the app needed a server to do anything; offline play made it
/// a correctness problem, because a reload emptied the caches a local game
/// renders its seats from. The constant survives as the one place a platform
/// without any storage at all would be declared.
const persistentApiCacheEnabled = true;

/// The device's own database: local games and persisted provider snapshots.
///
/// One connection for the session. A test overrides this with a database on
/// [NativeDatabase.memory].
@Riverpod(keepAlive: true)
Future<LocalDatabase> localDatabase(Ref ref) async {
  final database = LocalDatabase.open();
  ref.onDispose(database.close);
  return database;
}

/// Storage backend for persisted Riverpod API snapshots.
@Riverpod(keepAlive: true)
Future<Storage<String, String>> storage(Ref ref) async =>
    openJsonStorage(await ref.watch(localDatabaseProvider.future));
