import 'dart:convert';

import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';

/// Durable purchase-delivery outbox, in the replica database.
class DriftPurchaseDeliveryStore implements PurchaseDeliveryStore {
  DriftPurchaseDeliveryStore(this._database);

  final Future<ReplicaDatabase> _database;

  Future<CommerceDeliveries> get _outbox async =>
      CommerceDeliveries(await _database);

  @override
  Future<void> put(String provider, PurchaseUpdate update) async {
    final deliveryId = update.deliveryId;
    final evidence = update.evidence;
    if (deliveryId == null || evidence == null) {
      throw ArgumentError('A durable purchase needs deliveryId and evidence.');
    }
    await (await _outbox).put(
      provider: provider,
      deliveryId: deliveryId,
      offerKey: update.offerKey,
      providerReference: update.providerReference,
      evidence: jsonEncode(evidence),
      now: DateTime.now(),
    );
  }

  @override
  Future<List<PurchaseUpdate>> pending(String provider) async => [
    for (final delivery in await (await _outbox).pending(provider))
      PurchaseUpdate(
        deliveryId: delivery.deliveryId,
        offerKey: delivery.offerKey,
        providerReference: delivery.providerReference,
        state: PurchaseUpdateState.restored,
        evidence: (jsonDecode(delivery.evidence) as Map).cast<String, Object>(),
      ),
  ];

  @override
  Future<void> remove(String provider, String deliveryId) async =>
      (await _outbox).remove(provider, deliveryId);
}
