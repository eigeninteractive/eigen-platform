import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:checks/checks.dart';
import 'package:dio/dio.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

/// One frame's wire JSON. Only the fields the pipeline reasons about matter.
Map<String, dynamic> _frameJson(int version) => {
  'type': 'frame',
  'version': version,
  'data': <String, dynamic>{'v': version},
  'pendingPlayers': <int>[0],
  'deadline': null,
  'playerTimes': null,
};

/// One snapshot's wire JSON: the immutable header plus what moves.
Map<String, dynamic> _sessionJson({
  required int seq,
  required String status,
  int? version,
  bool frame = true,
}) => {
  'type': 'session',
  'seq': seq,
  'gameId': 'g',
  'shortCode': 'ABC123',
  'access': 'public',
  'schemaVersion': 1,
  'config': <String, dynamic>{},
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
  'version': version,
  'frame': version == null || !frame ? null : _frameJson(version),
};

Session _session({
  required int seq,
  String status = 'active',
  int? version,
  bool frame = true,
}) => Session.fromJson(
  _sessionJson(seq: seq, status: status, version: version, frame: frame),
);

/// Serves `GET .../frames?from=&to=` from an in-memory version range, so the
/// repository's gap recovery runs for real against a stubbed wire.
class _FramesAdapter implements HttpClientAdapter {
  _FramesAdapter(this.available);

  /// Versions the server would return.
  final List<int> available;

  /// Every `[from, to]` the repository asked for, in order.
  final requests = <({int from, int? to})>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final from = int.parse(options.queryParameters['from'].toString());
    final rawTo = options.queryParameters['to'];
    final to = rawTo == null ? null : int.parse(rawTo.toString());
    requests.add((from: from, to: to));

    final frames = available
        .where((v) => v >= from && (to == null || v <= to))
        .map(_frameJson)
        .toList();
    return ResponseBody.fromString(
      jsonEncode({'frames': frames}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// A socket the test drives by hand. Dart's implicit interfaces make this a
/// stub without needing an abstraction in the production code.
class _ScriptedSocket implements GameSocket {
  final _controller = StreamController<GameSocketEvent>();

  void emit(GameSocketEvent event) => _controller.add(event);

  @override
  Stream<GameSocketEvent> connect(String gameId) => _controller.stream;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

({GameRepository repo, _ScriptedSocket socket, _FramesAdapter adapter}) _build({
  List<int> available = const [],
}) {
  final adapter = _FramesAdapter(available);
  final dio = Dio(BaseOptions(baseUrl: 'https://engine.test'))
    ..httpClientAdapter = adapter;
  final socket = _ScriptedSocket();
  return (repo: GameRepository(dio, socket), socket: socket, adapter: adapter);
}

Future<({List<GameSession> sessions, List<Object> errors})> _captured(
  Stream<GameSession> stream,
  Future<void> Function() drive,
) async {
  final seen = <GameSession>[];
  final errors = <Object>[];
  final sub = stream.listen(seen.add, onError: errors.add);
  await drive();
  // Drain the asynchronous stream/Dio pipeline without depending on wall-clock
  // timing, which becomes flaky when the test runner executes many suites.
  for (var i = 0; i < 20; i++) {
    await Future<void>.delayed(Duration.zero);
  }
  await sub.cancel();
  return (sessions: seen, errors: errors);
}

/// Everything the stream emitted, in order, for a successful pipeline.
Future<List<GameSession>> _emitted(
  Stream<GameSession> stream,
  Future<void> Function() drive,
) async {
  final captured = await _captured(stream, drive);
  check(captured.errors).isEmpty();
  return captured.sessions;
}

void main() {
  test('emits the first snapshot as-is, without replaying history', () async {
    // A cold load snaps to the present: joining at v7 must not replay v0-v6.
    final t = _build(available: [0, 1, 2, 3, 4, 5, 6, 7]);

    final seen = await _emitted(t.repo.sessions('g'), () async {
      t.socket.emit(_session(seq: 8, version: 7));
    });

    check(seen.map((s) => s.version)).deepEquals([7]);
    check(t.adapter.requests).isEmpty();
  });

  test('passes consecutive snapshots straight through', () async {
    final t = _build();

    final seen = await _emitted(t.repo.sessions('g'), () async {
      for (var v = 3; v <= 5; v++) {
        t.socket.emit(_session(seq: v, version: v));
      }
    });

    check(seen.map((s) => s.version)).deepEquals([3, 4, 5]);
    check(t.adapter.requests).isEmpty();
  });

  test('fills a gap in order before the snapshot that revealed it', () async {
    // Every transition must be seen so the game can animate through each one.
    final t = _build(available: [1, 2, 3]);

    final seen = await _emitted(t.repo.sessions('g'), () async {
      t.socket.emit(_session(seq: 1, version: 0));
      t.socket.emit(_session(seq: 5, version: 4));
    });

    check(seen.map((s) => s.version)).deepEquals([0, 1, 2, 3, 4]);
    check(t.adapter.requests).deepEquals([(from: 1, to: 3)]);
  });

  test(
    'rejects an incomplete gap before applying any recovered frame',
    () async {
      final t = _build(available: [1, 3]);

      final captured = await _captured(t.repo.sessions('g'), () async {
        t.socket.emit(_session(seq: 1, version: 0));
        t.socket.emit(_session(seq: 5, version: 4));
      });

      check(captured.sessions.map((s) => s.version)).deepEquals([0]);
      check(captured.errors).length.equals(1);
      check(captured.errors.single).isA<StateError>();
    },
  );

  test('rejects out-of-order gap frames before applying them', () async {
    final t = _build(available: [2, 1, 3]);

    final captured = await _captured(t.repo.sessions('g'), () async {
      t.socket.emit(_session(seq: 1, version: 0));
      t.socket.emit(_session(seq: 5, version: 4));
    });

    check(captured.sessions.map((s) => s.version)).deepEquals([0]);
    check(captured.errors).length.equals(1);
    check(captured.errors.single).isA<StateError>();
  });

  test('holds the envelope still while a gap plays out', () async {
    // The rule that stops an animation rendering a finished game's banner over
    // mid-game moves: only the real snapshot may move the status.
    final t = _build(available: [1, 2]);

    final seen = await _emitted(t.repo.sessions('g'), () async {
      t.socket.emit(_session(seq: 1, status: 'active', version: 0));
      t.socket.emit(_session(seq: 4, status: 'finished', version: 3));
    });

    check(seen.map((s) => s.version)).deepEquals([0, 1, 2, 3]);
    check(
      seen.map((s) => s.status.name),
    ).deepEquals(['active', 'active', 'active', 'finished']);
    // `seq` holds still too, so a snapshot racing the animation is still
    // ordered against the last one the server actually stated.
    check(seen.map((s) => s.seq)).deepEquals([1, 1, 1, 4]);
  });

  test('carries the frame each snapshot replaced, for animation', () async {
    final t = _build();

    final seen = await _emitted(t.repo.sessions('g'), () async {
      t.socket.emit(_session(seq: 1, version: 0));
      t.socket.emit(_session(seq: 2, version: 1));
    });

    check(seen[0].previousFrame).isNull();
    check(seen[1].previousFrame?.version).equals(0);
    check(seen[1].frame?.version).equals(1);
  });

  test('discards a snapshot whose seq it already holds', () async {
    // The same session legitimately arrives twice: over the socket and on the
    // command response. Whichever loses the race must be dropped silently, and
    // a reconnect that missed nothing must not rebuild anything.
    final t = _build();

    final seen = await _emitted(t.repo.sessions('g'), () async {
      for (final seq in [4, 5, 5, 4, 3, 6]) {
        t.socket.emit(_session(seq: seq, version: seq));
      }
    });

    check(seen.map((s) => s.seq)).deepEquals([4, 5, 6]);
  });

  test('accepts a terminal snapshot whatever its seq', () async {
    // The abort teardown drops the storage `seq` lived in, so a re-initialised
    // object legitimately reports a lower one. A terminal status is absorbing,
    // so it needs no ordering.
    final t = _build();

    final seen = await _emitted(t.repo.sessions('g'), () async {
      t.socket.emit(_session(seq: 9, version: 3));
      t.socket.emit(_session(seq: 0, status: 'aborted', frame: false));
    });

    check(seen.map((s) => s.status.name)).deepEquals(['active', 'aborted']);
  });

  test(
    'does not resurrect a terminal game with a later active snapshot',
    () async {
      final t = _build();

      final seen = await _emitted(t.repo.sessions('g'), () async {
        t.socket.emit(_session(seq: 4, status: 'active', version: 3));
        t.socket.emit(_session(seq: 5, status: 'finished', version: 4));
        t.socket.emit(_session(seq: 6, status: 'active', version: 5));
      });

      check(seen.map((s) => s.status.name)).deepEquals(['active', 'finished']);
      check(seen.map((s) => s.seq)).deepEquals([4, 5]);
    },
  );

  test('accepts a newer terminal snapshot after finishing', () async {
    final t = _build();

    final seen = await _emitted(t.repo.sessions('g'), () async {
      t.socket.emit(_session(seq: 4, status: 'finished', version: 3));
      t.socket.emit(_session(seq: 5, status: 'finished', version: 4));
    });

    check(seen.map((s) => s.seq)).deepEquals([4, 5]);
  });

  test('an injected session renders without waiting for the socket', () async {
    // The socket-less paths: a freshly created solo game, and a move made
    // while the socket is mid-reconnect.
    final t = _build();
    final injected = StreamController<Session>();

    final seen = await _emitted(
      t.repo.sessions('g', inject: injected.stream),
      () async {
        injected.add(_session(seq: 1, version: 0));
        await Future<void>.delayed(Duration.zero);
        injected.add(_session(seq: 2, version: 1));
      },
    );

    check(seen.map((s) => s.version)).deepEquals([0, 1]);
    check(t.adapter.requests).isEmpty();
  });

  test('a lobby snapshot has no version and no frame', () async {
    final t = _build();

    final seen = await _emitted(t.repo.sessions('g'), () async {
      t.socket.emit(_session(seq: 1, status: 'waiting', frame: false));
      t.socket.emit(_session(seq: 2, status: 'ready', frame: false));
      t.socket.emit(_session(seq: 3, version: 0));
    });

    check(
      seen.map((s) => s.status.name),
    ).deepEquals(['waiting', 'ready', 'active']);
    check(seen[0].version).isNull();
    check(seen[0].frame).isNull();
    check(seen[2].version).equals(0);
    // No range fetch: the first version a client sees needs no predecessor.
    check(t.adapter.requests).isEmpty();
  });
}
