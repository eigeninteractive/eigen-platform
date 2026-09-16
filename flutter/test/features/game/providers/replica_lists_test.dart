import 'package:checks/checks.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_flutter/testing/memory_replica_host.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _me = 'user-a';

GameSummary _summary({
  required String id,
  required String status,
  int? finishedAt,
  List<int>? pending = const [0],
}) => GameSummary.fromJson({
  'id': id,
  'seq': 2,
  'createdBy': _me,
  'status': status,
  'access': 'public',
  'origin': 'online',
  'schemaVersion': 1,
  'config': <String, dynamic>{},
  'turnSeconds': 60,
  'budgetSeconds': null,
  'incrementSeconds': null,
  'rated': false,
  'ratingPool': null,
  'minPlayers': 2,
  'maxPlayers': 2,
  'shortCode': 'ABC123',
  'pendingPlayers': pending,
  'turnDeadline': null,
  'outcomes': null,
  'finishedAt': finishedAt,
  'createdAt': 1,
  'updatedAt': 2,
  'participants': <Map<String, dynamic>>[
    {'playerIndex': 0, 'userId': _me, 'botId': null, 'type': 'human'},
    {'playerIndex': 1, 'userId': 'user-b', 'botId': null, 'type': 'human'},
  ],
});

void main() {
  // The sync coordinator listens for connectivity, which is a platform
  // channel: without a binding there is nothing to listen to.
  TestWidgetsFlutterBinding.ensureInitialized();

  late ProviderContainer container;

  setUp(() {
    container = ProviderContainer.test(
      overrides: [
        replicaHostProvider.overrideWith((ref) async => MemoryReplicaHost()),
        currentUserIdProvider.overrideWithValue(_me),
      ],
    );
  });

  Future<AccountReplica> replica() async => (await container
      .read<Future<AccountReplica?>>(accountReplicaProvider.future))!;

  /// Lets the replica's writes reach the queries watching them.
  Future<void> settle() async {
    for (var i = 0; i < 10; i++) {
      await Future<void>.delayed(Duration.zero);
    }
  }

  test('the lists are the replica, with no request behind them', () async {
    final active = <List<GameSummary>>[];
    final ended = <List<GameSummary>>[];
    container.listen(
      activeGamesProvider,
      (_, next) => next.whenData(active.add),
      fireImmediately: true,
    );
    container.listen(
      finishedGamesProvider(limit: 10),
      (_, next) => next.whenData(ended.add),
      fireImmediately: true,
    );
    await settle();
    check(active.last).isEmpty();

    await (await replica()).applySummary(
      _summary(id: 'playing', status: 'active'),
    );
    await (await replica()).applySummary(
      _summary(id: 'ended', status: 'finished', finishedAt: 9, pending: null),
    );

    await settle();
    check(active.last.map((game) => game.id)).deepEquals(['playing']);
    check(ended.last.map((game) => game.id)).deepEquals(['ended']);
  });

  test('a signed-out device lists nothing rather than failing', () async {
    final signedOut = ProviderContainer.test(
      overrides: [
        replicaHostProvider.overrideWith((ref) async => MemoryReplicaHost()),
        currentUserIdProvider.overrideWithValue(null),
      ],
    );
    signedOut.listen(activeGamesProvider, (_, _) {});
    check(await signedOut.read(activeGamesProvider.future)).isEmpty();
    signedOut.dispose();
  });

  test('a sync pass with nobody signed in does nothing', () async {
    final signedOut = ProviderContainer.test(
      overrides: [
        replicaHostProvider.overrideWith((ref) async => MemoryReplicaHost()),
        currentUserIdProvider.overrideWithValue(null),
      ],
    );
    check(await signedOut.read(syncCoordinatorProvider.notifier).run())
        .isNull();
    check(signedOut.read(syncCoordinatorProvider).running).isFalse();
  });
}
