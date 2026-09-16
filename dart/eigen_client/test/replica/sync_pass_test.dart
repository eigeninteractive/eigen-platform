import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import '../local/counter_game.dart';
import 'memory_replica.dart';
import 'wire_fixtures.dart';

/// The engine, as far as a sync pass is concerned: the account sync, the
/// history page, and the bot catalog, answered from values a test sets.
class _SyncServer implements HttpClientAdapter {
  /// Responses to `GET /me/sync`, in order.
  final syncs = <Map<String, dynamic>>[];

  /// Responses to `GET /me/games/finished`, in order.
  final older = <Map<String, dynamic>>[];

  /// Every sync request's `finishedAfter`, null when absent.
  final cursors = <int?>[];

  /// Every history request's `cursor`.
  final floors = <String?>[];

  bool offline = false;

  Future<void>? hold;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final gate = hold;
    if (gate != null) await gate;
    if (offline) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }
    final path = options.path;
    if (path == '/api/engine/me/sync') {
      final after = options.queryParameters['finishedAfter'];
      cursors.add(after == null ? null : int.parse('$after'));
      return _json(syncs.removeAt(0));
    }
    if (path == '/api/engine/me/games/finished') {
      floors.add(options.queryParameters['cursor'] as String?);
      return _json(older.removeAt(0));
    }
    if (path == '/api/engine/bots') {
      return _json({
        'bots': [
          {
            'id': 'bot-1',
            'username': 'counter-bot',
            'displayName': 'Counter',
            'avatarUrl': null,
            'schemaVersion': 1,
            'type': 'local',
            'ratedEligible': false,
            'config': <String, dynamic>{},
            'tier': 'standard',
          },
        ],
      });
    }
    throw StateError('unexpected request $path');
  }

  ResponseBody _json(Map<String, dynamic> body) => ResponseBody.fromString(
    jsonEncode(body),
    200,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );

  @override
  void close({bool force = false}) {}
}

({
  SyncPass pass,
  _SyncServer server,
  AccountReplica replica,
  ReplicaDatabase db,
})
_build() {
  final server = _SyncServer();
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
    ..httpClientAdapter = server;
  final client = EigenClient(http: dio, baseUrl: 'https://example.test');
  final db = memoryReplica();
  final replica = AccountReplica(db, me);
  final storage = LocalGameStorage(db);
  return (
    pass: SyncPass(
      replica: replica,
      public: PublicReplica(db),
      account: client.account,
      games: client.games,
      localGames: LocalGameSync(
        storage: storage,
        games: client.games,
        userId: me,
      ),
      clock: () => DateTime.utc(2026, 9, 16),
    ),
    server: server,
    replica: replica,
    db: db,
  );
}

void main() {
  test(
    'a first pass asks for everything, and the next asks after its cursor',
    () async {
      final t = _build();
      t.server.syncs
        ..add(syncJson(active: [summaryJson(id: 'g', seq: 2)], cursor: 4))
        ..add(syncJson(active: [summaryJson(id: 'g', seq: 3)], cursor: 4));

      final first = await t.pass.run();
      expect(first.pulled, isTrue);
      await t.pass.run();

      expect(t.server.cursors, [null, 4]);
      expect((await t.replica.watchActiveGames().first).single.seq, 3);
      expect(await PublicReplica(t.db).bots(), hasLength(1));
    },
  );

  test('follows an increment across pages until it is drained', () async {
    final t = _build();
    t.server.syncs
      ..add(syncJson(cursor: 1))
      ..add(
        syncJson(
          finished: [
            summaryJson(id: 'a', seq: 2, status: 'finished', finishedAt: 1),
          ],
          cursor: 2,
          hasMore: true,
        ),
      )
      ..add(
        syncJson(
          finished: [
            summaryJson(id: 'b', seq: 2, status: 'finished', finishedAt: 2),
          ],
          cursor: 3,
        ),
      );

    await t.pass.run();
    await t.pass.run();

    expect(t.server.cursors, [null, 1, 2]);
    expect(await t.replica.finishedCursor(), 3);
    expect(
      (await t.replica.watchFinishedGames(limit: 10).first).map((g) => g.id),
      ['b', 'a'],
    );
  });

  test('an account created again under the same id starts over, keeping its '
      'local games', () async {
    final t = _build();
    final engine = await LocalGameEngine.create(
      userId: me,
      schemaVersion: 1,
      config: const {'target': 5},
      botIds: const ['bot-1'],
      bots: {'bot-1': counterBot()},
      rules: const CounterRules(),
      storage: LocalGameStorage(t.db),
      newGameId: () => 'local-1',
    );
    await engine.close();
    await t.replica.applySync(
      accountSync(active: [summaryJson(id: 'stale', seq: 2)], cursor: 9),
      first: true,
      endedSeen: const {},
      now: DateTime.utc(2026),
    );
    // Uploading the local game is not what this test is about.
    await LocalGameStorage(t.db)
        .mark(accountId: me, gameId: 'local-1', diverged: true);
    t.server.syncs
      ..add(syncJson(createdAt: 2, cursor: 9))
      ..add(syncJson(createdAt: 2, cursor: 0));

    final report = await t.pass.run();

    expect(report.pulled, isTrue);
    expect(t.server.cursors, [9, null]);
    expect((await t.replica.watchActiveGames().first).map((game) => game.id), [
      'local-1',
    ]);
    expect(await t.replica.createdAt(), 2);
  });

  test('a failed pull reports why and leaves the replica as it was', () async {
    final t = _build();
    t.server.syncs.add(syncJson(active: [summaryJson(id: 'g', seq: 2)]));
    await t.pass.run();
    t.server.offline = true;

    final report = await t.pass.run();

    expect(report.pulled, isFalse);
    expect(report.error, isA<DioException>());
    expect(await t.replica.watchActiveGames().first, hasLength(1));
  });

  test('pages older history from the floor until none remains', () async {
    final t = _build();
    t.server.syncs.add(syncJson(cursor: 5, floor: 'floor-1'));
    t.server.older
      ..add({
        'games': [
          summaryJson(id: 'old-1', seq: 2, status: 'finished', finishedAt: 2),
        ],
        'nextCursor': 'floor-2',
      })
      ..add({
        'games': [
          summaryJson(id: 'old-2', seq: 2, status: 'finished', finishedAt: 1),
        ],
        'nextCursor': null,
      });
    await t.pass.run();

    expect(await t.pass.loadOlderHistory(), isTrue);
    expect(await t.pass.loadOlderHistory(), isFalse);
    expect(await t.pass.loadOlderHistory(), isFalse);

    expect(t.server.floors, ['floor-1', 'floor-2']);
    expect(await t.replica.watchFinishedGames(limit: 10).first, hasLength(2));
  });

  test('a pass started mid-flight joins the one running', () async {
    final t = _build();
    final gate = Completer<void>();
    t.server
      ..hold = gate.future
      ..syncs.add(syncJson());

    final first = t.pass.run();
    final second = t.pass.run();
    gate.complete();

    expect(identical(await first, await second), isTrue);
    expect(t.server.cursors, [null]);
  });
}
