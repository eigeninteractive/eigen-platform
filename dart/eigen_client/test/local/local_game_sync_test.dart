import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:checks/checks.dart';
import 'package:dio/dio.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

/// One request the stub server saw, reduced to what an assertion cares about.
typedef _Seen = ({String method, String path, Map<String, dynamic>? body});

/// The engine, as far as these tests are concerned: it answers the three import
/// routes and the session read from values a test sets up, and records what it
/// was asked.
///
/// A stub adapter rather than a hand-rolled fake repository, so the real
/// generated serialization runs: a field the coordinator fills in wrongly fails
/// here rather than in production.
class _ImportServer implements HttpClientAdapter {
  _ImportServer({this.serverVersion = 0});

  final seen = <_Seen>[];

  /// The version the server's copy is at, advanced by every accepted append.
  int serverVersion;

  /// Status the stub reports, so a test can make the server's copy terminal.
  String status = 'active';

  /// Queued answers for `POST .../local/transitions`, in order. A null entry
  /// accepts the whole batch.
  final appendAnswers = <Map<String, dynamic>?>[];

  /// When set, every request fails as a transport error before it is answered.
  bool offline = false;

  /// When set, every request waits on it, so a test can decide what happens
  /// while a pass is in flight.
  Future<void>? hold;

  /// When set, the create route answers with this coded failure.
  ({int status, String code})? createFailure;

  /// When set, the next append answers with this coded failure.
  ({int status, String code})? appendFailure;

  /// The state the server's own log holds at each version. The device writes
  /// `{'count': version}`, so leaving this null makes the two copies agree and
  /// setting it makes them the different games a divergence is.
  Map<String, dynamic>? recordState;

  Map<String, dynamic> session({int? version}) => {
    'type': 'session',
    'seq': (version ?? 0) + 1,
    'gameId': 'game-1',
    'shortCode': '',
    'access': 'private',
    'origin': 'local',
    'schemaVersion': 1,
    'config': <String, dynamic>{'target': 3},
    'turnSeconds': null,
    'budgetSeconds': null,
    'incrementSeconds': null,
    'rated': false,
    'ratingPool': null,
    'minPlayers': 2,
    'maxPlayers': 2,
    'createdBy': 'user-a',
    'status': status,
    'players': <Map<String, dynamic>>[],
    'version': version ?? serverVersion,
    'frame': null,
  };

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final gate = hold;
    if (gate != null) await gate;
    final path = options.path;
    // The generated client encodes its body before Dio sees it, so a request
    // arrives here as JSON text rather than a map.
    final data = options.data;
    final body = data is String && data.isNotEmpty
        ? (jsonDecode(data) as Map).cast<String, dynamic>()
        : null;
    seen.add((method: options.method, path: path, body: body));
    if (offline) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'offline',
      );
    }

    if (path == '/api/engine/games/local') {
      final failure = createFailure;
      if (failure != null) return _error(failure);
      return _json(201, {'session': session()});
    }
    if (path.endsWith('/local/transitions')) {
      final failure = appendFailure;
      if (failure != null) {
        appendFailure = null;
        return _error(failure);
      }
      final count = (body!['transitions'] as List).length;
      final queued = appendAnswers.isEmpty ? null : appendAnswers.removeAt(0);
      if (queued != null) {
        serverVersion += queued['applied'] as int;
        return _json(200, {
          ...queued,
          'session': session(version: serverVersion),
        });
      }
      serverVersion += count;
      return _json(200, {
        'applied': count,
        'session': session(version: serverVersion),
        'rejection': null,
      });
    }
    if (path.endsWith('/session')) return _json(200, session());
    if (path.endsWith('/local')) {
      final query = options.queryParameters;
      final from = (query['from'] as int?) ?? 0;
      final to = (query['to'] as int?) ?? serverVersion;
      return _json(200, {
        'session': session(),
        'seed': 'a' * 32,
        'createdAt': DateTime.utc(2026, 9, 12).millisecondsSinceEpoch,
        'finishedAt': null,
        'transitions': [
          for (
            var v = from;
            v <= (to < serverVersion ? to : serverVersion);
            v++
          )
            {
              'version': v,
              'state': recordState ?? {'count': v},
              'action': null,
              'pending': <int>[],
            },
        ],
      });
    }
    throw StateError('unexpected request $path');
  }

  ResponseBody _json(int status, Map<String, dynamic> body) =>
      ResponseBody.fromString(
        jsonEncode(body),
        status,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );

  ResponseBody _error(({int status, String code}) failure) =>
      _json(failure.status, {'error': 'refused', 'code': failure.code});

  @override
  void close({bool force = false}) {}
}

/// A record with [moves] committed moves after the start transition, as the
/// engine would have written it.
LocalGameRecord _record({int moves = 2, bool remoteCreated = false}) {
  final transitions = <LocalGameTransition>[
    const LocalGameTransition(
      version: 0,
      state: {'count': 0},
      action: null,
      pending: [0],
    ),
    for (var move = 1; move <= moves; move++)
      LocalGameTransition(
        version: move,
        state: {'count': move},
        action: LocalTransitionAction(
          type: move.isOdd ? LocalActionType.user : LocalActionType.bot,
          kind: LocalActionKind.game,
          data: const {'add': 1},
          playerIndex: move.isOdd ? 0 : 1,
        ),
        pending: [move.isOdd ? 1 : 0],
      ),
  ];
  return LocalGameRecord(
    id: 'game-1',
    createdBy: 'user-a',
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
    status: GameStatus.active,
    seq: moves + 1,
    transitions: transitions,
    frames: const {},
    remoteCreated: remoteCreated,
    syncedVersion: remoteCreated ? 0 : LocalGameRecord.notSynced,
  );
}

({LocalGameSync sync, InMemoryLocalGameStore store}) _sync(
  _ImportServer server,
) {
  final dio = Dio(BaseOptions(baseUrl: 'https://example.test'))
    ..httpClientAdapter = server;
  final store = InMemoryLocalGameStore();
  return (
    sync: LocalGameSync(
      store: store,
      games: EigenClient(http: dio, baseUrl: 'https://example.test').games,
      userId: 'user-a',
    ),
    store: store,
  );
}

void main() {
  test('creates the server copy, then appends every committed move', () async {
    final server = _ImportServer();
    final (:sync, :store) = _sync(server);
    await store.save(_record());

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.synced);
    final saved = (await store.load('game-1'))!;
    check(saved.remoteCreated).isTrue();
    check(saved.syncedVersion).equals(2);
    check(saved.diverged).isFalse();
    // Version 0 is the server's own start transition and is never sent.
    final append = server.seen.firstWhere(
      (request) => request.path.endsWith('/local/transitions'),
    );
    check((append.body!['transitions'] as List).length).equals(2);
    check(append.body!['fromVersion']).equals(0);
  });

  test('sends the seed and the bot roster on create', () async {
    final server = _ImportServer();
    final (:sync, :store) = _sync(server);
    await store.save(_record());

    await sync.syncAll();

    final create = server.seen.first;
    check(create.path).equals('/api/engine/games/local');
    check(create.body!['seed']).equals('a' * 32);
    check(create.body!['gameId']).equals('game-1');
    check(create.body!['botIds'] as List).deepEquals(['bot-1']);
  });

  test('resumes from the recorded point instead of resending', () async {
    final server = _ImportServer(serverVersion: 1);
    final (:sync, :store) = _sync(server);
    await store.save(
      _record(moves: 3, remoteCreated: true).copyWith(syncedVersion: 1),
    );

    await sync.syncAll();

    final append = server.seen.firstWhere(
      (request) => request.path.endsWith('/local/transitions'),
    );
    check(append.body!['fromVersion']).equals(1);
    check((append.body!['transitions'] as List).length).equals(2);
  });

  test('a rejected move marks the game diverged and stops', () async {
    final server = _ImportServer()
      ..appendAnswers.add({
        'applied': 1,
        'rejection': {'index': 1, 'code': 'illegalMove', 'message': 'no'},
      });
    final (:sync, :store) = _sync(server);
    await store.save(_record());

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.diverged);
    final saved = (await store.load('game-1'))!;
    check(saved.diverged).isTrue();
    // The move that did commit is still recorded as carried.
    check(saved.syncedVersion).equals(1);
  });

  test('a diverged record is never retried', () async {
    final server = _ImportServer();
    final (:sync, :store) = _sync(server);
    await store.save(_record().copyWith(diverged: true));

    final report = await sync.syncAll();

    check(report.outcomes).isEmpty();
    check(server.seen).isEmpty();
  });

  test('an unreachable server leaves the record untouched', () async {
    final server = _ImportServer()..offline = true;
    final (:sync, :store) = _sync(server);
    await store.save(_record());

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.unreachable);
    check(report.hasPending).isTrue();
    final saved = (await store.load('game-1'))!;
    check(saved.remoteCreated).isFalse();
    check(saved.syncedVersion).equals(LocalGameRecord.notSynced);
  });

  test('a foreign game id is refused without retrying', () async {
    final server = _ImportServer()
      ..createFailure = (status: 403, code: 'notCreator');
    final (:sync, :store) = _sync(server);
    await store.save(_record());

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.refused);
    check((await store.load('game-1'))!.remoteCreated).isFalse();
  });

  test('a stale marker is corrected from the server session', () async {
    final server = _ImportServer(serverVersion: 1)
      ..appendFailure = (status: 409, code: 'stateUpdated');
    final (:sync, :store) = _sync(server);
    // This device believes nothing has landed, but the server holds version 1:
    // a create whose response was lost.
    await store.save(_record(moves: 2, remoteCreated: true));

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.synced);
    check((await store.load('game-1'))!.syncedVersion).equals(2);
  });

  test('a server at this device\'s own version, holding this device\'s own '
      'state, is a lost response rather than a divergence', () async {
    final server = _ImportServer(serverVersion: 2)
      ..appendFailure = (status: 409, code: 'stateUpdated');
    final (:sync, :store) = _sync(server);
    await store.save(_record(moves: 2, remoteCreated: true));

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.synced);
    check((await store.load('game-1'))!.syncedVersion).equals(2);
    check((await store.load('game-1'))!.diverged).isFalse();
  });

  test('a server at this device\'s own version holding a different state is a '
      'divergence, which versions alone cannot see', () async {
    final server = _ImportServer(serverVersion: 2)
      ..appendFailure = (status: 409, code: 'stateUpdated')
      // Another device played two moves of its own. The counts match; the
      // games do not.
      ..recordState = const {'count': 7};
    final (:sync, :store) = _sync(server);
    await store.save(_record(moves: 2, remoteCreated: true));

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.diverged);
    check((await store.load('game-1'))!.diverged).isTrue();
  });

  test('a server copy ahead of this device is a divergence', () async {
    final server = _ImportServer(serverVersion: 5)
      ..appendFailure = (status: 409, code: 'stateUpdated');
    final (:sync, :store) = _sync(server);
    await store.save(_record(moves: 2, remoteCreated: true));

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.diverged);
    check((await store.load('game-1'))!.diverged).isTrue();
  });

  test('adopts a terminal status the server reached first', () async {
    final server = _ImportServer()..status = 'aborted';
    final (:sync, :store) = _sync(server);
    await store.save(_record());

    final report = await sync.syncAll();

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.terminal);
    check((await store.load('game-1'))!.status).equals(GameStatus.aborted);
  });

  test('a second pass started mid-flight joins the first', () async {
    final server = _ImportServer();
    final (:sync, :store) = _sync(server);
    await store.save(_record());

    final first = sync.syncAll();
    final second = sync.syncAll();
    check(identical(await first, await second)).isTrue();

    // One create, one append: the second call did no work of its own.
    check(
      server.seen.where((r) => r.path == '/api/engine/games/local').length,
    ).equals(1);
  });

  test('a move committed while the pass ran survives it', () async {
    // The engine is the other writer, and connectivity returning is exactly
    // when a game is likely to be open on screen.
    final gate = Completer<void>();
    final server = _ImportServer()..hold = gate.future;
    final (:sync, :store) = _sync(server);
    await store.save(_record(moves: 2, remoteCreated: true));
    final pass = sync.syncAll();
    // A third move lands after the pass read the record and before its first
    // request is answered.
    await store.save(_record(moves: 3, remoteCreated: true));
    gate.complete();
    final report = await pass;

    check(report.outcomes['game-1']).equals(LocalSyncOutcome.synced);
    final saved = (await store.load('game-1'))!;
    // Writing back the snapshot the pass started from would have dropped the
    // third move entirely. It is still here, and the pass went on to carry it.
    check(saved.transitions.length).equals(4);
    check(saved.version).equals(3);
    check(saved.syncedVersion).equals(3);
  });

  test('a game the server already holds in full is left alone', () async {
    final server = _ImportServer(serverVersion: 2);
    final (:sync, :store) = _sync(server);
    await store.save(_record(remoteCreated: true).copyWith(syncedVersion: 2));

    final report = await sync.syncAll();

    check(report.outcomes).isEmpty();
    check(server.seen).isEmpty();
  });
}
