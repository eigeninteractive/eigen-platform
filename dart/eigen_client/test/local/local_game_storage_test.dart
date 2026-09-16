import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import '../replica/memory_replica.dart';
import 'counter_game.dart';

Future<LocalGameEngine> _play(
  LocalGameStorage storage, {
  int target = 5,
  String gameId = 'game-1',
}) => LocalGameEngine.create(
  userId: 'user-1',
  schemaVersion: 1,
  config: {'target': target},
  botIds: const ['bot-1'],
  bots: {'bot-1': counterBot()},
  rules: const CounterRules(),
  storage: storage,
  clock: () => DateTime.utc(2026, 9, 12, 10),
  newGameId: () => gameId,
  newSeed: () => 'deadbeefdeadbeefdeadbeefdeadbeef',
);

void main() {
  test('a played game reads back as the engine left it', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _play(storage);
    addTearDown(engine.close);
    await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );
    await pumpEventQueue();

    final restored = (await storage.load(
      accountId: 'user-1',
      gameId: 'game-1',
    ))!;
    final original = engine.game;

    expect(restored.id, 'game-1');
    expect(restored.createdBy, 'user-1');
    expect(restored.createdAt, original.createdAt);
    expect(restored.seed, original.seed);
    expect(restored.schemaVersion, 1);
    expect(restored.status, GameStatus.active);
    expect(restored.seq, original.seq);
    expect(restored.syncedVersion, LocalGame.notSynced);
    expect(restored.remoteCreated, isFalse);
    expect(restored.diverged, isFalse);
    expect(restored.roster.map((seat) => seat.type), [
      SeatTypeEnum.human,
      SeatTypeEnum.bot,
    ]);
    expect(restored.roster.last.botId, 'bot-1');
    expect(restored.version, 2);
    expect(restored.latest!.action!.type, LocalActionType.bot);
    expect(restored.latest!.action!.kind, LocalActionKind.game);
    expect(restored.humanSeat, 0);
    expect(restored.stateRow!.rngSeed, original.seed);
    expect(restored.meta.status, GameStatus.active);
  });

  test('a finished game keeps its outcomes and finish instant', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _play(storage, target: 1);
    addTearDown(engine.close);
    await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );

    final restored = (await storage.load(
      accountId: 'user-1',
      gameId: 'game-1',
    ))!;

    expect(restored.status, GameStatus.finished);
    expect(restored.isTerminal, isTrue);
    expect(restored.finishedAt, DateTime.utc(2026, 9, 12, 10));
    expect(restored.outcomes!.map((outcome) => outcome.playerIndex), [0, 1]);
    expect(restored.outcomes!.first.result, OutcomeResultEnum.win);
    expect(restored.needsSync, isTrue);
  });

  test('a local game is listed like any other game, with no merge', () async {
    final db = memoryReplica();
    final storage = LocalGameStorage(db);
    final engine = await _play(storage);
    addTearDown(engine.close);

    final active = await AccountReplica(db, 'user-1').watchActiveGames().first;
    final game = active.single;
    expect(game.id, 'game-1');
    expect(game.origin, GameOrigin.local);
    expect(game.access, GameAccess.private);
    expect(game.rated, isFalse);
    expect(game.shortCode, isEmpty);
    expect(game.participants, hasLength(2));
    expect(game.pendingPlayers, [0]);
  });

  test('a sync mark writes only its own fields, so a move committed during '
      'the pass survives it', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _play(storage);
    addTearDown(engine.close);

    // The pass read the game at version 0...
    final seen = (await storage.load(accountId: 'user-1', gameId: 'game-1'))!;
    // ...the engine commits two more versions...
    await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );
    await pumpEventQueue();
    // ...and the pass records what the server said about the version it saw.
    final marked = await storage.mark(
      accountId: 'user-1',
      gameId: seen.id,
      remoteCreated: true,
      syncedVersion: 0,
    );

    expect(marked.version, 2);
    expect(marked.remoteCreated, isTrue);
    expect(marked.syncedVersion, 0);
    expect(marked.needsSync, isTrue);
  });

  test('pages the log after a version, oldest first', () async {
    final storage = LocalGameStorage(memoryReplica());
    final engine = await _play(storage);
    addTearDown(engine.close);
    for (var version = 0; version < 4; version += 2) {
      await engine.submitAction(
        seat: 0,
        data: const {'step': 1},
        expectedVersion: version,
      );
      await pumpEventQueue();
    }

    final page = await storage.transitionsAfter(
      accountId: 'user-1',
      gameId: 'game-1',
      afterVersion: 1,
      limit: 2,
    );
    expect(page.map((transition) => transition.version), [2, 3]);
    expect(
      await storage.stateAt(accountId: 'user-1', gameId: 'game-1', version: 3),
      isNotNull,
    );
    expect(
      await storage.stateAt(accountId: 'user-1', gameId: 'game-1', version: 9),
      isNull,
    );
  });

  test('forgetting a game removes every row of it', () async {
    final db = memoryReplica();
    final storage = LocalGameStorage(db);
    final engine = await _play(storage);
    await engine.close();

    await storage.forget(accountId: 'user-1', gameId: 'game-1');

    expect(await storage.load(accountId: 'user-1', gameId: 'game-1'), isNull);
    expect(
      await AccountReplica(db, 'user-1').watchActiveGames().first,
      isEmpty,
    );
  });

  test('a minted id and seed have the shapes the server expects', () {
    final id = newLocalGameId();
    final seed = newLocalSeed();

    expect(
      id,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-'
          r'[0-9a-f]{12}$',
        ),
      ),
    );
    expect(seed, matches(RegExp(r'^[0-9a-f]{32}$')));
    expect(newLocalGameId(), isNot(id));
    expect(newLocalSeed(), isNot(seed));
  });
}
