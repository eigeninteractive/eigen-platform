import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import '../replica/memory_replica.dart';
import 'counter_game.dart';

/// A seed whose version-0 draw opens the counter game on seat 0, the human.
const _seed = 'deadbeefdeadbeefdeadbeefdeadbeef';

Future<LocalGameEngine> _open(
  LocalGameStorage storage, {
  String username = 'counter-bot',
  int target = 5,
  BotRunner botRunner = const InlineBotRunner(),
}) => LocalGameEngine.create(
  userId: 'user-1',
  schemaVersion: 1,
  config: {'target': target},
  botIds: const ['bot-1'],
  bots: {'bot-1': counterBot(username: username)},
  rules: const CounterRules(),
  storage: storage,
  botRunner: botRunner,
  clock: () => DateTime.utc(2026, 9, 12, 10),
  newGameId: () => 'game-1',
  newSeed: () => _seed,
);

/// The log exactly as the replica holds it.
Future<List<LocalGameTransition>> _log(LocalGameStorage storage) =>
    storage.transitionsAfter(
      accountId: 'user-1',
      gameId: 'game-1',
      afterVersion: -1,
      limit: 1000,
    );

void main() {
  test('creates, starts and persists a game with no network', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _open(storage);
    addTearDown(engine.close);

    final session = engine.current;
    expect(session.gameId, 'game-1');
    expect(session.status, GameStatus.active);
    expect(session.version, 0);
    expect(session.seq, 1);
    // Every local-only decision, stated once in `localSession`.
    expect(session.access, GameAccess.private);
    expect(session.rated, isFalse);
    expect(session.turnSeconds, isNull);
    expect(session.budgetSeconds, isNull);
    expect(session.players.map((seat) => seat.type), [
      SeatTypeEnum.human,
      SeatTypeEnum.bot,
    ]);
    expect(session.frame!.pendingPlayers, [0]);
    expect(session.frame!.deadline, isNull);

    final stored = (await storage.load(accountId: 'user-1', gameId: 'game-1'))!;
    expect(stored.seed, _seed);
    expect(stored.version, 0);
  });

  test(
    'runs the bot chain after a human move and persists each commit',
    () async {
      final storage = LocalGameStorage(memoryReplica());
      final engine = await _open(storage);
      addTearDown(engine.close);
      final stated = <Session>[];
      engine.sessions.listen(stated.add);

      final accepted = await engine.submitAction(
        seat: 0,
        data: const {'step': 3},
        expectedVersion: 0,
      );

      expect(accepted.session.version, 1);
      expect(accepted.session.frame!.data, isA<Map<String, dynamic>>());
      // The human's own commit resolves immediately; the bot is still thinking.
      expect(engine.game.latest!.action!.type, LocalActionType.user);

      await pumpEventQueue();

      final log = await _log(storage);
      expect(log.map((transition) => transition.version), [0, 1, 2]);
      expect(log.last.action!.type, LocalActionType.bot);
      expect(log.last.action!.playerIndex, 1);
      // The brain drew from its own stream, so the move is the one the server
      // would have self-applied. The stream is keyed to the version the bot
      // acts FROM — 1, the human's commit — not the one it produces, which is
      // what the Durable Object does beside `expectedVersion: next.version`.
      final expectedStep =
          1 + (EigenRng.forBot(_seed, 1, 1).next() * 3).floor();
      expect(log.last.action!.data, {'step': expectedStep});

      expect(engine.game.latest!.pending, [0]);
      expect(engine.current.seq, 3);
      expect(stated.map((session) => session.seq), [2, 3]);
      // Each commit is durable when it resolves: a crash costs at most the move
      // in flight.
      final stored = (await storage.load(
        accountId: 'user-1',
        gameId: 'game-1',
      ))!;
      expect(stored.version, 2);
      expect(stored.seq, 3);
    },
  );

  test(
    'seq and version advance by one per commit until the game ends',
    () async {
      final storage = LocalGameStorage(memoryReplica());
      final engine = await _open(storage, target: 3);
      addTearDown(engine.close);

      await engine.submitAction(
        seat: 0,
        data: const {'step': 3},
        expectedVersion: 0,
      );
      await pumpEventQueue();

      final record = engine.game;
      expect(record.status, GameStatus.finished);
      expect(record.finishedAt, isNotNull);
      expect(record.outcomes!.map((outcome) => outcome.result), [
        OutcomeResultEnum.win,
        OutcomeResultEnum.loss,
      ]);
      expect(record.version, 1);
      expect(record.seq, 2);
      // The finishing frame carries the outcomes, exactly as the server's does.
      expect(engine.current.frame!.outcomes, hasLength(2));
      expect(engine.current.status, GameStatus.finished);
    },
  );

  test('a rejection surfaces as the matching engine error', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _open(storage);
    addTearDown(engine.close);

    await expectLater(
      engine.submitAction(seat: 0, data: const {'step': 1}, expectedVersion: 7),
      throwsA(
        isA<EngineException>().having(
          (error) => error.code,
          'code',
          ErrorCode.stateUpdated,
        ),
      ),
    );
    await expectLater(
      engine.submitAction(
        seat: 0,
        data: const {'step': 99},
        expectedVersion: 0,
      ),
      throwsA(
        isA<EngineException>().having(
          (error) => error.code,
          'code',
          ErrorCode.illegalMove,
        ),
      ),
    );
    await expectLater(
      engine.submitAction(seat: 1, data: const {'step': 1}, expectedVersion: 0),
      throwsA(
        isA<EngineException>().having(
          (error) => error.code,
          'code',
          ErrorCode.notPending,
        ),
      ),
    );
    // A refused command changes nothing.
    expect(engine.game.version, 0);
    expect(await _log(storage), hasLength(1));
  });

  test('a resign finishes the game through the lifecycle hook', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _open(storage);
    addTearDown(engine.close);

    final accepted = await engine.forfeit(seat: 0);

    expect(accepted.session.status, GameStatus.finished);
    expect(engine.game.latest!.action!.kind, LocalActionKind.lifecycle);
    expect(engine.game.outcomes!.first.result, OutcomeResultEnum.loss);
  });

  test(
    'a brain that throws reports a failed turn and leaves the seat pending',
    () async {
      final storage = LocalGameStorage(memoryReplica());
      final engine = await _open(storage, username: 'broken-bot');
      addTearDown(engine.close);
      final failures = <Object>[];
      engine.sessions.listen((_) {}, onError: failures.add);

      await engine.submitAction(
        seat: 0,
        data: const {'step': 1},
        expectedVersion: 0,
      );
      await pumpEventQueue();

      expect(failures, hasLength(1));
      final failure = failures.single as LocalBotFailed;
      expect(failure.seat, 1);
      expect(failure.botId, 'bot-1');
      expect(failure.cause, isA<StateError>());
      // No deadline exists to move the game on, so the seat is simply still
      // waiting and the game is resumable.
      expect(engine.game.latest!.pending, [1]);
      expect(engine.game.version, 1);
    },
  );

  test('a brain that returns an illegal move fails the same way', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _open(storage, username: 'cheating-bot');
    addTearDown(engine.close);
    final failures = <Object>[];
    engine.sessions.listen((_) {}, onError: failures.add);

    await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );
    await pumpEventQueue();

    expect(
      (failures.single as LocalBotFailed).cause,
      isA<EngineException>().having(
        (error) => error.code,
        'code',
        ErrorCode.illegalMove,
      ),
    );
    expect(engine.game.latest!.pending, [1]);
  });

  test('a brain that yields still commits in order', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _open(storage, username: 'slow-bot');
    addTearDown(engine.close);

    await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );
    await pumpEventQueue();

    expect(engine.game.latest!.action!.data, {'step': 1});
    expect(engine.game.latest!.pending, [0]);
  });

  test('reopening a stored game continues the same game', () async {
    final storage = LocalGameStorage(memoryReplica());
    final first = await _open(storage);
    await first.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );
    await pumpEventQueue();
    await first.close();

    final engine = (await LocalGameEngine.open(
      accountId: 'user-1',
      gameId: 'game-1',
      rules: const CounterRules(),
      storage: storage,
      bots: {'bot-1': counterBot()},
    ))!;
    addTearDown(engine.close);

    expect(engine.current.version, 2);
    expect(engine.current.seq, 3);
    final accepted = await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 2,
    );
    expect(accepted.session.version, 3);
  });

  test('the replica holds only the human\'s frames, and a reopened engine '
      'derives the bot\'s from the log', () async {
    final db = memoryReplica();
    final storage = LocalGameStorage(db);
    final first = await _open(storage);
    await first.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );
    await pumpEventQueue();
    await first.close();

    final replay = await AccountReplica(db, 'user-1').replayFrames('game-1');
    expect(replay!.map((frame) => frame.version), [0, 1, 2]);

    // The bot is pending at version 2 only after the human moves again, and it
    // can only move if the reopened engine re-derived its observation.
    final engine = (await LocalGameEngine.open(
      accountId: 'user-1',
      gameId: 'game-1',
      rules: const CounterRules(),
      storage: storage,
      bots: {'bot-1': counterBot()},
    ))!;
    addTearDown(engine.close);
    await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 2,
    );
    await pumpEventQueue();
    expect(engine.game.version, 4);
    expect(engine.game.latest!.action!.type, LocalActionType.bot);
  });

  test('an unknown game opens no engine', () async {
    final engine = await LocalGameEngine.open(
      accountId: 'user-1',
      gameId: 'nothing-here',
      rules: const CounterRules(),
      storage: LocalGameStorage(memoryReplica()),
      bots: const {},
    );
    expect(engine, isNull);
  });
}
