import 'dart:async';

import 'package:dio/dio.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import 'memory_replica.dart';
import 'wire_fixtures.dart';

/// A socket the test drives by hand.
class _ScriptedSocket implements GameSocket {
  final _controller = StreamController<GameSocketEvent>();

  void emit(GameSocketEvent event) => _controller.add(event);

  void fail(Object error) => _controller.addError(error);

  @override
  Stream<GameSocketEvent> connect(String gameId) => _controller.stream;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _settle() async {
  for (var i = 0; i < 20; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  late AccountReplica replica;
  late _ScriptedSocket socket;
  late GameRepository games;

  setUp(() {
    replica = AccountReplica(memoryReplica(), me);
    socket = _ScriptedSocket();
    games = GameRepository(Dio(), socket);
  });

  test('opens from the replica before anything arrives live', () async {
    await replica.applySession(
      session(seq: 4, version: 3),
      now: DateTime.utc(2026),
    );
    final seen = <GameSession>[];
    final sub = replicatedSessions(
      replica: replica,
      games: games,
      gameId: 'g',
    ).listen(seen.add);
    addTearDown(sub.cancel);
    await _settle();

    expect(seen.single.seq, 4);
    expect(seen.single.frame!.version, 3);
  });

  test('stores every live session as it passes, so a reopen with no network '
      'shows where the game was left', () async {
    final seen = <GameSession>[];
    final sub = replicatedSessions(
      replica: replica,
      games: games,
      gameId: 'g',
    ).listen(seen.add);
    await _settle();
    expect(seen, isEmpty);

    socket.emit(session(seq: 2, version: 1));
    await _settle();
    await sub.cancel();

    final cold = (await replica.coldSession('g'))!;
    expect(cold.seq, 2);
    expect(cold.frame!.version, 1);
  });

  test(
    'a live snapshot at the replica copy\'s own revision still lands',
    () async {
      // A sync moved the header on without serving the board.
      await replica.applySession(
        session(seq: 3, version: 2),
        now: DateTime.utc(2026),
      );
      await replica.applySummary(summary(id: 'g', seq: 5));
      final seen = <GameSession>[];
      final sub = replicatedSessions(
        replica: replica,
        games: games,
        gameId: 'g',
      ).listen(seen.add);
      addTearDown(sub.cancel);
      await _settle();

      socket.emit(session(seq: 5, version: 4));
      await _settle();

      expect(seen.map((s) => s.frame?.version), [2, 4]);
    },
  );

  test(
    'a connection failure after opening keeps the replica copy on screen',
    () async {
      await replica.applySession(
        session(seq: 4, version: 3),
        now: DateTime.utc(2026),
      );
      final seen = <GameSession>[];
      final errors = <Object>[];
      final sub = replicatedSessions(
        replica: replica,
        games: games,
        gameId: 'g',
      ).listen(seen.add, onError: errors.add);
      addTearDown(sub.cancel);
      await _settle();

      socket.fail(StateError('offline'));
      await _settle();

      expect(seen.single.seq, 4);
      expect(errors, hasLength(1));
    },
  );
}
