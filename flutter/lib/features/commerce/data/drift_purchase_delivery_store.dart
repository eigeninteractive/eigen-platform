import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:eigen_flutter/core/local/local_database.dart';
import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';

/// Durable purchase-delivery outbox in the shared Drift database.
class DriftPurchaseDeliveryStore implements PurchaseDeliveryStore {
  DriftPurchaseDeliveryStore(this._database);

  final Future<LocalDatabase> _database;

  @override
  Future<void> put(String provider, PurchaseUpdate update) async {
    final deliveryId = update.deliveryId;
    final evidence = update.evidence;
    if (deliveryId == null || evidence == null) {
      throw ArgumentError('A durable purchase needs deliveryId and evidence.');
    }
    final database = await _database;
    await database.customStatement(
      '''
      INSERT INTO commerce_deliveries (
        provider, delivery_id, offer_key, provider_reference, evidence,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(provider, delivery_id) DO UPDATE SET
        offer_key = excluded.offer_key,
        provider_reference = excluded.provider_reference,
        evidence = excluded.evidence
      ''',
      [
        provider,
        deliveryId,
        update.offerKey,
        update.providerReference,
        jsonEncode(evidence),
        DateTime.now().millisecondsSinceEpoch,
      ],
    );
  }

  @override
  Future<List<PurchaseUpdate>> pending(String provider) async {
    final database = await _database;
    final rows = await database
        .customSelect(
          '''
          SELECT delivery_id, offer_key, provider_reference, evidence
          FROM commerce_deliveries
          WHERE provider = ?
          ORDER BY created_at, delivery_id
          ''',
          variables: [Variable<String>(provider)],
        )
        .get();
    return [
      for (final row in rows)
        PurchaseUpdate(
          deliveryId: row.read<String>('delivery_id'),
          offerKey: row.read<String>('offer_key'),
          providerReference: row.read<String>('provider_reference'),
          state: PurchaseUpdateState.restored,
          evidence: (jsonDecode(row.read<String>('evidence')) as Map)
              .cast<String, Object>(),
        ),
    ];
  }

  @override
  Future<void> remove(String provider, String deliveryId) async {
    final database = await _database;
    await database.customStatement(
      'DELETE FROM commerce_deliveries WHERE provider = ? AND delivery_id = ?',
      [provider, deliveryId],
    );
  }
}
