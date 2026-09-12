import 'package:checks/checks.dart';
import 'package:drift/native.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/game/game_module.dart';
import 'package:eigen_flutter/core/local/drift_local_game_store.dart';
import 'package:eigen_flutter/core/local/isolate_bot_runner.dart';
import 'package:eigen_flutter/core/local/local_database.dart';
import 'package:eigen_flutter/features/game/providers/local_game_providers.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

import 'counter_local_game.dart';

Bot _bot(String username, {BotType type = BotType.local}) => Bot(
  id: username,
  username: username,
  displayName: username,
  avatarUrl: null,
  schemaVersion: 1,
  type: type,
  ratedEligible: false,
  config: const <String, dynamic>{},
);

void main() {
  late LocalDatabase database;
  late DriftLocalGameStore store;

  setUp(() {
    database = LocalDatabase(NativeDatabase.memory());
    store = DriftLocalGameStore(database);
  });
  tearDown(() => database.close());

  test('plays a whole game on the device and persists every commit', () async {
    final engine = await LocalGameEngine.create(
      userId: 'user-a',
      schemaVersion: 1,
      config: const {'target': 4},
      botIds: const ['counter-bot'],
      bots: {'counter-bot': _bot('counter-bot')},
      rules: const CounterLocalRules(),
      store: store,
    );
    addTearDown(engine.close);

    // The opening board exists before anything touched a network.
    check(engine.current.version).equals(0);
    check(engine.current.status).equals(GameStatus.active);
    check(engine.current.origin).equals(GameOrigin.local);
    check(engine.current.rated).isFalse();
    check(engine.current.turnSeconds).isNull();

    // A human move; the bot answers on its own through the same queue.
    await engine.submitAction(
      seat: 0,
      data: const {'add': 1},
      expectedVersion: 0,
    );
    await _settle(
      engine,
      until: (record) =>
          record.humanSeat == 0 &&
          (record.latest?.pending.contains(0) ?? false),
    );

    final saved = await store.load(engine.record.id);
    check(saved).isNotNull();
    // Version 0 (start), 1 (the human), 2 (the bot).
    check(saved!.transitions.length).isGreaterOrEqual(3);
    check(saved.transitions[2].action!.type).equals(LocalActionType.bot);
    check(saved.seed).equals(engine.record.seed);
    check(saved.syncedVersion).equals(LocalGameRecord.notSynced);
  });

  test(
    'a rejected move surfaces as the same exception a server one does',
    () async {
      final engine = await LocalGameEngine.create(
        userId: 'user-a',
        schemaVersion: 1,
        config: const {'target': 4},
        botIds: const ['counter-bot'],
        bots: {'counter-bot': _bot('counter-bot')},
        rules: const CounterLocalRules(),
        store: store,
      );
      addTearDown(engine.close);

      Object? thrown;
      try {
        await engine.submitAction(
          seat: 0,
          data: const {'add': 0},
          expectedVersion: 0,
        );
      } on Object catch (error) {
        thrown = error;
      }
      check(thrown)
          .isA<EngineException>()
          .has((e) => e.code, 'code')
          .equals(ErrorCode.illegalMove);
    },
  );

  test('a broken brain is reported and leaves the seat pending', () async {
    final engine = await LocalGameEngine.create(
      userId: 'user-a',
      schemaVersion: 1,
      config: const {'target': 9},
      botIds: const ['counter-broken'],
      bots: {'counter-broken': _bot('counter-broken')},
      rules: const CounterLocalRules(),
      store: store,
    );
    addTearDown(engine.close);

    final failures = <Object>[];
    engine.sessions.listen((_) {}, onError: failures.add);
    await engine.submitAction(
      seat: 0,
      data: const {'add': 1},
      expectedVersion: 0,
    );
    await Future<void>.delayed(const Duration(milliseconds: 50));

    check(failures).isNotEmpty();
    check(failures.first).isA<LocalBotFailed>();
    // The game is resumable: the bot's seat is still the one to move.
    check(engine.record.latest!.pending).deepEquals([1]);
  });

  test(
    'the isolate runner answers with the same move the inline one does',
    () async {
      const job = LocalBotJob(
        rules: CounterLocalRules(),
        botUsername: 'counter-bot',
        observation: {'count': 0},
        pendingPlayers: [1],
        botConfig: {},
        playerIndex: 1,
        config: {'target': 4},
        seed: 'abcdef',
        version: 2,
      );

      final inIsolate = await const IsolateBotRunner().run(job);
      final inline = await const InlineBotRunner().run(job);

      check(inIsolate).deepEquals(inline);
    },
  );

  test('the summary a list shows matches the record', () async {
    final engine = await LocalGameEngine.create(
      userId: 'user-a',
      schemaVersion: 1,
      config: const {'target': 4},
      botIds: const ['counter-bot'],
      bots: {'counter-bot': _bot('counter-bot')},
      rules: const CounterLocalRules(),
      store: store,
    );
    addTearDown(engine.close);

    final summary = localGameSummaryOf(engine.record);
    check(summary.id).equals(engine.record.id);
    check(summary.origin).equals(GameOrigin.local);
    check(summary.access).equals(GameAccess.private);
    check(summary.rated).isFalse();
    check(summary.turnSeconds).isNull();
    check(summary.participants).length.equals(2);
    check(summary.pendingPlayers).isNotNull();
  });

  test('replay reads the frames the record already holds', () async {
    final engine = await LocalGameEngine.create(
      userId: 'user-a',
      schemaVersion: 1,
      config: const {'target': 2},
      botIds: const ['counter-bot'],
      bots: {'counter-bot': _bot('counter-bot')},
      rules: const CounterLocalRules(),
      store: store,
    );
    addTearDown(engine.close);
    await engine.submitAction(
      seat: 0,
      data: const {'add': 2},
      expectedVersion: 0,
    );

    final frames = localReplayFrames(engine.record, seat: 0);
    check(frames).length.equals(2);
    check(frames.first.version).equals(0);
    check(frames.last.outcomes).isNotNull();
    check(frames.last.deadline).isNull();
  });

  test(
    'a pulled record continues the game where the other device left it',
    () async {
      // What the catch-up path hands to the engine: the server's copy, rebuilt
      // through this build's own rules.
      final record = localRecordFromRemote(
        remote: _remoteRecord(upTo: 2),
        rules: const CounterLocalRules(),
      );
      await store.save(record);

      final engine = LocalGameEngine(
        record: record,
        rules: const CounterLocalRules(),
        store: store,
        bots: {'counter-bot': _bot('counter-bot')},
      );
      addTearDown(engine.close);

      // It resumes at the version the other device reached, not at zero.
      check(engine.current.version).equals(2);
      check(engine.record.syncedVersion).equals(2);

      // And it plays on: the human moves, the bot answers, both from here.
      await engine.submitAction(
        seat: 0,
        data: const {'add': 1},
        expectedVersion: 2,
      );
      await _settle(engine, until: (record) => (record.version ?? 0) >= 4);

      final saved = (await store.load('pulled-1'))!;
      check(saved.version ?? 0).isGreaterOrEqual(4);
      check(saved.transitions[3].action!.type).equals(LocalActionType.user);
      check(saved.transitions[4].action!.type).equals(LocalActionType.bot);
      // The moves made here are ahead of what the server holds, so the next
      // synchronization pass has exactly them to carry.
      check(saved.syncedVersion).equals(2);
    },
  );

  test('usableLocalBots keeps only bots this build can run', () {
    const module = _CounterModule();
    final bots = [
      _bot('counter-bot'),
      // No brain under this username.
      _bot('unknown-bot'),
      // Hosted elsewhere: the device cannot run it whatever its username.
      _bot('counter-bot-external', type: BotType.external_),
    ];

    final usable = usableLocalBots(bots, module, config: const {'target': 3});

    check(usable.map((bot) => bot.username)).deepEquals(['counter-bot']);
  });
}

/// The server's copy of a counter game, as the import route would answer it.
LocalRecord _remoteRecord({required int upTo}) => LocalRecord(
  session: Session.fromJson({
    'type': 'session',
    'seq': upTo + 1,
    'gameId': 'pulled-1',
    'shortCode': '',
    'access': 'private',
    'origin': 'local',
    'schemaVersion': 1,
    'config': <String, dynamic>{'target': 9},
    'turnSeconds': null,
    'budgetSeconds': null,
    'incrementSeconds': null,
    'rated': false,
    'ratingPool': null,
    'minPlayers': 2,
    'maxPlayers': 2,
    'createdBy': 'user-a',
    'status': 'active',
    'players': <Map<String, dynamic>>[
      {'playerIndex': 0, 'userId': 'user-a', 'botId': null, 'type': 'human'},
      {'playerIndex': 1, 'userId': null, 'botId': 'counter-bot', 'type': 'bot'},
    ],
    'version': upTo,
    'frame': null,
  }),
  seed: 'c' * 32,
  createdAt: DateTime.utc(2026, 9, 1).millisecondsSinceEpoch,
  finishedAt: null,
  transitions: [
    for (var version = 0; version <= upTo; version++)
      LocalTransitionRow(
        version: version,
        state: {'count': version},
        action: version == 0
            ? null
            : TransitionAction(
                type: version.isOdd
                    ? TransitionActionTypeEnum.user
                    : TransitionActionTypeEnum.bot,
                kind: TransitionActionKindEnum.game,
                data: const {'add': 1},
                playerIndex: version.isOdd ? 0 : 1,
              ),
        pending: [version.isEven ? 0 : 1],
      ),
  ],
);

/// Waits for the engine's queue to reach a state, or gives up.
Future<void> _settle(
  LocalGameEngine engine, {
  required bool Function(LocalGameRecord) until,
}) async {
  for (var attempt = 0; attempt < 50; attempt++) {
    if (until(engine.record)) return;
    await Future<void>.delayed(const Duration(milliseconds: 10));
  }
}

/// The smallest module that declares a local unit.
class _CounterModule extends GameModule {
  const _CounterModule();

  @override
  Map<int, GameRules> get versions => const {1: _CounterRules()};

  @override
  GameCreationSpec get creationSpec => const GameCreationSpec(
    timingConfigs: {'Untimed': UntimedConfig()},
    defaultConfig: {'target': 3},
  );

  @override
  Widget? buildCreationConfig({
    required ValueChanged<Map<String, dynamic>> onChanged,
  }) => null;

  @override
  Widget buildRules(BuildContext context) => const SizedBox.shrink();
}

class _CounterRules
    extends
        GameRules<
          Map<String, dynamic>,
          Map<String, dynamic>,
          Map<String, dynamic>
        > {
  const _CounterRules();

  @override
  Map<String, dynamic> parseConfig(Map<String, dynamic> json) => json;

  @override
  Map<String, dynamic> parseObservation(Map<String, dynamic> json) => json;

  @override
  Map<String, dynamic> parseAction(Map<String, dynamic> json) => json;

  @override
  Map<String, dynamic> serializeAction(Map<String, dynamic> action) => action;

  @override
  bool isValidAction({
    required Map<String, dynamic> obs,
    required List<int> pending,
    required Map<String, dynamic> data,
    required int playerIndex,
    required Map<String, dynamic> config,
  }) => pending.contains(playerIndex);

  @override
  Map<String, dynamic>? previewAction({
    required Map<String, dynamic> obs,
    required List<int> pending,
    required Map<String, dynamic> data,
    required int playerIndex,
    required Map<String, dynamic> config,
  }) => null;

  @override
  Widget buildContent(GameContentContext context) => const SizedBox.shrink();

  @override
  PlayerLimits playerLimits(Map<String, dynamic> config) =>
      const PlayerLimits(minPlayers: 2, maxPlayers: 2);

  @override
  String? ratingPool(RatingPoolArgs args) => null;

  @override
  bool botSeatable(BotSeatableArgs args) => true;

  @override
  CounterLocalRules get local => const CounterLocalRules();
}
