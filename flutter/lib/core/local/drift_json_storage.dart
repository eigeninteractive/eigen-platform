import 'dart:async';

import 'package:drift/drift.dart';
import 'package:flutter_riverpod/experimental/persist.dart';

import 'local_database.dart';

/// Riverpod's persisted-provider storage, over [LocalDatabase]'s `kv` table.
///
/// One storage engine on every platform, which is what makes the web half of
/// offline play possible at all: the browser had no persistence before this, so
/// a reload emptied the bot and player caches a local game renders its seats
/// from. The native path moved here too rather than keeping a second SQLite
/// binding beside it for the same job.
final class DriftJsonStorage extends Storage<String, String> {
  DriftJsonStorage(this._database);

  final LocalDatabase _database;

  @override
  FutureOr<PersistedData<String>?> read(String key) async {
    final row = await _database
        .customSelect(
          'SELECT value, destroy_key, expire_at FROM kv WHERE key = ?',
          variables: [Variable<String>(key)],
        )
        .getSingleOrNull();
    if (row == null) return null;
    final expireAt = row.read<int?>('expire_at');
    return PersistedData(
      row.read<String>('value'),
      destroyKey: row.read<String?>('destroy_key'),
      expireAt: expireAt == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(expireAt, isUtc: true),
    );
  }

  @override
  FutureOr<void> write(String key, String value, StorageOptions options) async {
    final duration = options.cacheTime.duration;
    await _database.customStatement(
      'INSERT OR REPLACE INTO kv (key, value, destroy_key, expire_at) '
      'VALUES (?, ?, ?, ?)',
      [
        key,
        value,
        options.destroyKey,
        duration == null
            ? null
            : DateTime.now().toUtc().add(duration).millisecondsSinceEpoch,
      ],
    );
  }

  @override
  FutureOr<void> delete(String key) async {
    await _database.customStatement('DELETE FROM kv WHERE key = ?', [key]);
  }

  /// Drops expired rows, which Riverpod calls once when the storage opens.
  ///
  /// A row with no expiry is never dropped here: that is what
  /// [StorageCacheTime.unsafe_forever] means, and the caches offline play
  /// depends on use it so that a month spent offline cannot empty them.
  @override
  void deleteOutOfDate() {
    unawaited(
      _database.customStatement('DELETE FROM kv WHERE expire_at < ?', [
        DateTime.now().toUtc().millisecondsSinceEpoch,
      ]),
    );
  }
}
