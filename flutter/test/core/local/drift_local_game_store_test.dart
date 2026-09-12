import 'package:checks/checks.dart';
import 'package:drift/native.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/local/drift_json_storage.dart';
import 'package:eigen_flutter/core/local/drift_local_game_store.dart';
import 'package:eigen_flutter/core/local/local_database.dart';
import 'package:flutter_riverpod/experimental/persist.dart';
import 'package:flutter_test/flutter_test.dart';

LocalGameRecord _record({
  String id = 'game-1',
  String userId = 'user-a',
  GameStatus status = GameStatus.active,
}) => LocalGameRecord(
  id: id,
  createdBy: userId,
  createdAt: DateTime.utc(2026, 9, 12),
  schemaVersion: 1,
  config: const {'target': 3},
  seed: 'a' * 32,
  roster: const [
    LocalSeat(
      playerIndex: 0,
      userId: 'user-a',
      botId: null,
      type: SeatTypeEnum.human,
    ),
    LocalSeat(
      playerIndex: 1,
      userId: null,
      botId: 'bot-1',
      type: SeatTypeEnum.bot,
    ),
  ],
  status: status,
  seq: 1,
  transitions: const [
    LocalGameTransition(
      version: 0,
      state: {'count': 0},
      action: null,
      pending: [0],
    ),
  ],
  frames: const {
    0: [
      LocalObservationFrame(
        playerIndex: 0,
        data: {'count': 0},
        pendingPlayers: [0],
      ),
    ],
  },
);

void main() {
  late LocalDatabase database;

  setUp(() => database = LocalDatabase(NativeDatabase.memory()));
  tearDown(() => database.close());

  group('DriftLocalGameStore', () {
    test('round-trips a record through its JSON blob', () async {
      final store = DriftLocalGameStore(database);
      await store.save(_record());

      final loaded = await store.load('game-1');
      check(loaded).isNotNull();
      check(loaded!.seed).equals('a' * 32);
      check(loaded.roster.length).equals(2);
      check(loaded.transitions.single.state['count']).equals(0);
      check(loaded.frameFor(seat: 0, version: 0)).isNotNull();
    });

    test('replaces rather than duplicates on every commit', () async {
      final store = DriftLocalGameStore(database);
      await store.save(_record());
      await store.save(_record().copyWith(seq: 7));

      final all = await store.list('user-a');
      check(all).length.equals(1);
      check(all.single.seq).equals(7);
    });

    test('scopes records to the user who created them', () async {
      final store = DriftLocalGameStore(database);
      await store.save(_record(id: 'mine'));
      await store.save(_record(id: 'theirs', userId: 'user-b'));

      check(await store.list('user-a')).length.equals(1);
      check((await store.list('user-b')).single.id).equals('theirs');
      // A record another account owns is still readable by id: the store is
      // not the authorization boundary, the account that holds the device is.
      check(await store.load('theirs')).isNotNull();
    });

    test('deleteFor removes one account\'s games and no others', () async {
      final store = DriftLocalGameStore(database);
      await store.save(_record(id: 'mine'));
      await store.save(_record(id: 'theirs', userId: 'user-b'));

      await store.deleteFor('user-a');

      check(await store.list('user-a')).isEmpty();
      check(await store.list('user-b')).length.equals(1);
    });

    test('delete removes one game', () async {
      final store = DriftLocalGameStore(database);
      await store.save(_record());
      await store.delete('game-1');
      check(await store.load('game-1')).isNull();
    });
  });

  group('DriftJsonStorage', () {
    test('round-trips a value with its metadata', () async {
      final storage = DriftJsonStorage(database);
      await storage.write(
        'k',
        '{"a":1}',
        const StorageOptions(
          destroyKey: '2',
          cacheTime: StorageCacheTime(Duration(days: 1)),
        ),
      );

      final read = await storage.read('k');
      check(read).isNotNull();
      check(read!.data).equals('{"a":1}');
      check(read.destroyKey).equals('2');
      check(read.expireAt).isNotNull();
    });

    test('a forever entry records no expiry', () async {
      final storage = DriftJsonStorage(database);
      await storage.write(
        'bots',
        '[]',
        const StorageOptions(cacheTime: StorageCacheTime.unsafe_forever),
      );

      check((await storage.read('bots'))!.expireAt).isNull();
    });

    test(
      'deleteOutOfDate keeps a forever entry and drops a stale one',
      () async {
        final storage = DriftJsonStorage(database);
        await storage.write(
          'bots',
          '[]',
          const StorageOptions(cacheTime: StorageCacheTime.unsafe_forever),
        );
        // An entry whose window has already closed.
        await database.customStatement(
          'INSERT INTO kv (key, value, destroy_key, expire_at) '
          'VALUES (?, ?, ?, ?)',
          ['stale', '[]', null, 0],
        );

        storage.deleteOutOfDate();
        // The delete is issued without awaiting, as Riverpod calls it; give the
        // statement a turn to land before reading.
        await database.customStatement('SELECT 1');

        check(await storage.read('bots')).isNotNull();
        check(await storage.read('stale')).isNull();
      },
    );

    test('delete removes an entry', () async {
      final storage = DriftJsonStorage(database);
      await storage.write('k', 'v', const StorageOptions());
      await storage.delete('k');
      check(await storage.read('k')).isNull();
    });
  });
}
