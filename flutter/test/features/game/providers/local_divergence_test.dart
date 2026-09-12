import 'package:checks/checks.dart';
import 'package:drift/native.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/game/game_module.dart';
import 'package:eigen_flutter/core/local/drift_local_game_store.dart';
import 'package:eigen_flutter/core/local/local_database.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:eigen_flutter/features/game/providers/local_game_providers.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../core/local/counter_local_game.dart';
import '../../../helpers/container.dart';

/// Rules that ship an on-device unit, which is what makes a record playable.
class _LocalRules
    extends
        GameRules<
          Map<String, dynamic>,
          Map<String, dynamic>,
          Map<String, dynamic>
        > {
  const _LocalRules();

  @override
  CounterLocalRules get local => const CounterLocalRules();

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
}

class _Module extends GameModule {
  const _Module();

  @override
  Map<int, GameRules> get versions => const {1: _LocalRules()};

  @override
  GameCreationSpec get creationSpec => const GameCreationSpec();

  @override
  Widget? buildCreationConfig({
    required ValueChanged<Map<String, dynamic>> onChanged,
  }) => null;

  @override
  Widget buildRules(BuildContext context) => const SizedBox.shrink();
}

Bot _bot() => Bot(
  id: 'counter-bot',
  username: 'counter-bot',
  displayName: 'Counter',
  avatarUrl: null,
  schemaVersion: 1,
  type: BotType.local,
  ratedEligible: false,
  config: <String, dynamic>{},
);

void main() {
  late LocalDatabase database;
  late DriftLocalGameStore store;

  setUp(() {
    database = LocalDatabase(NativeDatabase.memory());
    store = DriftLocalGameStore(database);
  });
  tearDown(() => database.close());

  Future<LocalGameRecord> seed() async {
    final engine = await LocalGameEngine.create(
      userId: 'user-a',
      schemaVersion: 1,
      config: const {'target': 4},
      botIds: const ['counter-bot'],
      bots: {'counter-bot': _bot()},
      rules: const CounterLocalRules(),
      store: store,
    );
    addTearDown(engine.close);
    return engine.record;
  }

  ProviderContainer containerFor() => makeContainer(
    overrides: [
      localGameStoreProvider.overrideWith((ref) async => store),
      currentGameModuleProvider.overrideWithValue(const _Module()),
      botCatalogByIdProvider.overrideWith(
        (ref) async => {'counter-bot': _bot()},
      ),
      botRunnerProvider.overrideWithValue(const InlineBotRunner()),
    ],
  );

  test('an ordinary record gets an engine, so the device plays it', () async {
    final record = await seed();
    final container = containerFor();

    final engine = await container.read(
      localGameEngineProvider(gameId: record.id).future,
    );

    check(engine).isNotNull();
  });

  test(
    'a diverged record gets no engine, which is what stops local play',
    () async {
      final record = await seed();
      // The server refused a move these rules accepted, or another device moved
      // the game on. Either way the two copies are of different games from here.
      await store.save(record.copyWith(diverged: true));
      final container = containerFor();

      final engine = await container.read(
        localGameEngineProvider(gameId: record.id).future,
      );

      // No engine is what makes the session fall through to the server's copy and
      // the command port refuse with `localOnly`, rather than committing further
      // moves onto a log the server will never accept.
      check(engine).isNull();
    },
  );
}
