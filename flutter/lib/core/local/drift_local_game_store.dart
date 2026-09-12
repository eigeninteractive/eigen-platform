import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:eigen_client/eigen_client.dart';

import 'local_database.dart';

/// The [LocalGameStore] a device actually runs on: one row per local game in
/// [LocalDatabase].
///
/// Records survive sign-out. They are scoped by the user who created them, so
/// signing back in finds them again, and a second account on the same device
/// never sees another's games. They are removed only by [delete], which account
/// deletion calls through [deleteFor].
final class DriftLocalGameStore implements LocalGameStore {
  const DriftLocalGameStore(this._database);

  final LocalDatabase _database;

  @override
  Future<List<LocalGameRecord>> list(String userId) async {
    final rows = await _database
        .customSelect(
          'SELECT record FROM local_games WHERE user_id = ? '
          'ORDER BY updated_at DESC',
          variables: [Variable<String>(userId)],
        )
        .get();
    return [for (final row in rows) _decode(row.read<String>('record'))];
  }

  @override
  Future<LocalGameRecord?> load(String id) async {
    final row = await _database
        .customSelect(
          'SELECT record FROM local_games WHERE id = ?',
          variables: [Variable<String>(id)],
        )
        .getSingleOrNull();
    return row == null ? null : _decode(row.read<String>('record'));
  }

  @override
  Future<void> save(LocalGameRecord record) async {
    await _database.customStatement(
      'INSERT OR REPLACE INTO local_games '
      '(id, user_id, status, updated_at, record) VALUES (?, ?, ?, ?, ?)',
      [
        record.id,
        record.createdBy,
        record.status.value,
        DateTime.now().toUtc().millisecondsSinceEpoch,
        jsonEncode(record.toJson()),
      ],
    );
  }

  @override
  Future<void> delete(String id) async {
    await _database.customStatement('DELETE FROM local_games WHERE id = ?', [
      id,
    ]);
  }

  /// Removes every game [userId] created: what account deletion runs, since a
  /// deleted account's games are its own and nothing else can reach them.
  Future<void> deleteFor(String userId) async {
    await _database.customStatement(
      'DELETE FROM local_games WHERE user_id = ?',
      [userId],
    );
  }

  LocalGameRecord _decode(String record) =>
      LocalGameRecord.fromJson(jsonDecode(record) as Map<String, dynamic>);
}
