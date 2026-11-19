import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import 'memory_replica.dart';

void main() {
  test(
    'purchase delivery is isolated across a device account switch',
    () async {
      final db = memoryReplica();
      final alice = CommerceDeliveries(db, 'alice');
      final bob = CommerceDeliveries(db, 'bob');

      Future<void> queue(
        CommerceDeliveries outbox,
        String id,
        String evidence,
      ) => outbox.put(
        provider: 'google_play',
        deliveryId: id,
        offerKey: 'supporter',
        providerReference: 'supporter_once',
        evidence: evidence,
        now: DateTime.utc(2026),
      );

      await queue(alice, 'play-1', '{"token":"alice"}');
      expect(await bob.pending('google_play'), isEmpty);
      await queue(bob, 'play-1', '{"token":"unexpected-callback"}');
      expect(
        (await bob.pending('google_play')).single.evidence,
        '{"token":"unexpected-callback"}',
      );
      await bob.remove('google_play', 'play-1');
      expect(await bob.pending('google_play'), isEmpty);
      expect(
        (await alice.pending('google_play')).single.evidence,
        '{"token":"alice"}',
      );

      await queue(bob, 'play-2', '{"token":"bob"}');
      await AccountReplica(db, 'alice').deleteAll();
      expect(await alice.pending('google_play'), isEmpty);
      expect((await bob.pending('google_play')).single.deliveryId, 'play-2');
    },
  );
}
