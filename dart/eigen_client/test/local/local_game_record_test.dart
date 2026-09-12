import 'dart:convert';

import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import 'counter_game.dart';

void main() {
  test('a played record survives the store round trip', () async {
    final store = InMemoryLocalGameStore();
    final engine = await LocalGameEngine.create(
      userId: 'user-1',
      schemaVersion: 1,
      config: const {'target': 5},
      botIds: const ['bot-1'],
      bots: {'bot-1': counterBot()},
      rules: const CounterRules(),
      store: store,
      clock: () => DateTime.utc(2026, 9, 12, 10),
      newGameId: () => 'game-1',
      newSeed: () => 'deadbeefdeadbeefdeadbeefdeadbeef',
    );
    addTearDown(engine.close);
    await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );
    await pumpEventQueue();
    final original = engine.record.copyWith(
      syncedVersion: 1,
      remoteCreated: true,
      diverged: true,
    );

    // Through a real encode/decode, because the Drift adapter stores the
    // document as text and a value that only round-trips in memory is not
    // actually persistable.
    final restored = LocalGameRecord.fromJson(
      jsonDecode(jsonEncode(original.toJson())) as Map<String, dynamic>,
    );

    expect(restored.toJson(), original.toJson());
    expect(restored.id, 'game-1');
    expect(restored.createdBy, 'user-1');
    expect(restored.createdAt, original.createdAt);
    expect(restored.seed, original.seed);
    expect(restored.schemaVersion, 1);
    expect(restored.status, GameStatus.active);
    expect(restored.seq, original.seq);
    expect(restored.syncedVersion, 1);
    expect(restored.remoteCreated, isTrue);
    expect(restored.diverged, isTrue);
    expect(restored.roster.map((seat) => seat.type), [
      SeatTypeEnum.human,
      SeatTypeEnum.bot,
    ]);
    expect(restored.roster.last.botId, 'bot-1');
    expect(restored.transitions.map((transition) => transition.version), [
      0,
      1,
      2,
    ]);
    expect(restored.latest!.action!.type, LocalActionType.bot);
    expect(restored.latest!.action!.kind, LocalActionKind.game);
    expect(restored.frames.keys.toList()..sort(), [0, 1, 2]);
    expect(restored.frameFor(seat: 0, version: 2)!.data, isNotEmpty);
    expect(restored.frameFor(seat: 9, version: 2), isNull);
    expect(restored.humanSeat, 0);
    expect(restored.stateRow!.version, 2);
    expect(restored.stateRow!.rngSeed, original.seed);
    expect(restored.meta.status, GameStatus.active);
  });

  test('a finished record keeps its outcomes and finish instant', () async {
    final store = InMemoryLocalGameStore();
    final engine = await LocalGameEngine.create(
      userId: 'user-1',
      schemaVersion: 1,
      config: const {'target': 1},
      botIds: const ['bot-1'],
      bots: {'bot-1': counterBot()},
      rules: const CounterRules(),
      store: store,
      clock: () => DateTime.utc(2026, 9, 12, 10),
      newGameId: () => 'game-2',
      newSeed: () => 'deadbeefdeadbeefdeadbeefdeadbeef',
    );
    addTearDown(engine.close);
    await engine.submitAction(
      seat: 0,
      data: const {'step': 1},
      expectedVersion: 0,
    );

    final restored = LocalGameRecord.fromJson(
      jsonDecode(jsonEncode(engine.record.toJson())) as Map<String, dynamic>,
    );

    expect(restored.status, GameStatus.finished);
    expect(restored.isTerminal, isTrue);
    expect(restored.finishedAt, DateTime.utc(2026, 9, 12, 10));
    expect(restored.outcomes!.map((outcome) => outcome.playerIndex), [0, 1]);
    expect(restored.outcomes!.first.result, OutcomeResultEnum.win);
    expect(restored.outcomes!.first.placement, 1);
    expect(restored.syncedVersion, LocalGameRecord.notSynced);
    expect(restored.remoteCreated, isFalse);
    expect(restored.diverged, isFalse);
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
