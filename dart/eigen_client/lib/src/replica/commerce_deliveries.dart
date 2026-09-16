import 'package:drift/drift.dart';

import 'replica_database.dart';

/// One store purchase the device holds evidence for and has not yet delivered.
typedef PendingDelivery = ({
  String deliveryId,
  String offerKey,
  String providerReference,

  /// The provider's evidence, as the JSON text it was stored as.
  String evidence,
});

/// The purchase-delivery outbox, in the replica database.
///
/// A purchase the device holds evidence for survives a restart until its claim
/// lands, oldest first, so a delivery is never lost to a crash between the
/// store's callback and the server's answer.
final class CommerceDeliveries {
  const CommerceDeliveries(this._db);

  final ReplicaDatabase _db;

  /// Records a delivery, or updates what an earlier record of it says without
  /// moving its place in the queue.
  Future<void> put({
    required String provider,
    required String deliveryId,
    required String offerKey,
    required String providerReference,
    required String evidence,
    required DateTime now,
  }) => _db
      .into(_db.commerceDeliveries)
      .insert(
        CommerceDeliveriesCompanion.insert(
          provider: provider,
          deliveryId: deliveryId,
          offerKey: offerKey,
          providerReference: providerReference,
          evidence: evidence,
          createdAt: now.millisecondsSinceEpoch,
        ),
        onConflict: DoUpdate(
          (_) => CommerceDeliveriesCompanion(
            offerKey: Value(offerKey),
            providerReference: Value(providerReference),
            evidence: Value(evidence),
          ),
        ),
      );

  /// Every undelivered purchase for [provider], oldest first.
  Future<List<PendingDelivery>> pending(String provider) async {
    final rows =
        await (_db.select(_db.commerceDeliveries)
              ..where((row) => row.provider.equals(provider))
              ..orderBy([
                (row) => OrderingTerm.asc(row.createdAt),
                (row) => OrderingTerm.asc(row.deliveryId),
              ]))
            .get();
    return [
      for (final row in rows)
        (
          deliveryId: row.deliveryId,
          offerKey: row.offerKey,
          providerReference: row.providerReference,
          evidence: row.evidence,
        ),
    ];
  }

  /// Removes a delivered purchase.
  Future<void> remove(String provider, String deliveryId) =>
      (_db.delete(_db.commerceDeliveries)..where(
            (row) =>
                row.provider.equals(provider) &
                row.deliveryId.equals(deliveryId),
          ))
          .go();
}
