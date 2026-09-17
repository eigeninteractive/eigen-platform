import 'package:checks/checks.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/replica/replica_host.dart';
import 'package:eigen_flutter/core/replica/replica_providers.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';
import 'package:eigen_flutter/features/game/providers/keep_local_games.dart';
import 'package:eigen_flutter/testing/memory_replica_host.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/local/counter_local_game.dart';
import '../../../helpers/container.dart';

const _me = 'user-a';

Bot _bot() => Bot(
  id: 'counter-bot',
  username: 'counter-bot',
  displayName: 'Counter',
  avatarUrl: null,
  schemaVersion: 1,
  type: BotType.local,
  ratedEligible: false,
  config: <String, dynamic>{},
  tier: 'standard',
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MemoryReplicaHost host;

  ProviderContainer containerFor({
    StoragePersistence persistence = StoragePersistence.askable,
  }) {
    host = MemoryReplicaHost(persistenceMode: persistence);
    final container = makeContainer(
      overrides: [
        replicaHostProvider.overrideWith((ref) async => host),
        currentUserIdProvider.overrideWithValue(_me),
      ],
    );
    // The card watches it; without a listener it is disposed mid-read.
    container.listen(keepLocalGamesProvider, (_, _) {});
    return container;
  }

  /// A game played on this device that the server does not hold yet.
  Future<void> seedLocalGame(ProviderContainer container) async {
    final storage = await container.read(localGameStorageProvider.future);
    final engine = await LocalGameEngine.create(
      userId: _me,
      schemaVersion: 1,
      config: const {'target': 4},
      botIds: const ['counter-bot'],
      bots: {'counter-bot': _bot()},
      rules: const CounterLocalRules(),
      storage: storage,
    );
    addTearDown(engine.close);
  }

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('offers while a game is on this device alone', () async {
    final container = containerFor();
    await seedLocalGame(container);

    check(await container.read(keepLocalGamesProvider.future)).isTrue();
  });

  test('says nothing until a game is at stake', () async {
    final container = containerFor();

    check(await container.read(keepLocalGamesProvider.future)).isFalse();
  });

  test('says nothing where storage is already kept, as on a device', () async {
    final container = containerFor(persistence: StoragePersistence.granted);
    await seedLocalGame(container);

    check(await container.read(keepLocalGamesProvider.future)).isFalse();
    check(host.persistenceRequested).isFalse();
  });

  test('says nothing where the browser has refused', () async {
    final container = containerFor(persistence: StoragePersistence.refused);
    await seedLocalGame(container);

    check(await container.read(keepLocalGamesProvider.future)).isFalse();
  });

  test('asks the browser once, and does not offer again', () async {
    final container = containerFor();
    await seedLocalGame(container);
    check(await container.read(keepLocalGamesProvider.future)).isTrue();

    final decision = await container
        .read(keepLocalGamesProvider.notifier)
        .keep();

    check(decision).equals(StoragePersistence.granted);
    check(host.persistenceRequested).isTrue();
    check(await container.read(keepLocalGamesProvider.future)).isFalse();
  });

  test('a declined offer is not made again', () async {
    final container = containerFor();
    await seedLocalGame(container);
    check(await container.read(keepLocalGamesProvider.future)).isTrue();

    await container.read(keepLocalGamesProvider.notifier).dismiss();

    check(await container.read(keepLocalGamesProvider.future)).isFalse();
    check(host.persistenceRequested).isFalse();
  });
}
