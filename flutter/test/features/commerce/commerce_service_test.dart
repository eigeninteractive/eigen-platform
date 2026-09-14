import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/features/commerce/data/commerce_service.dart';
import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';
import 'package:flutter_test/flutter_test.dart';

AccessSnapshot _access() => AccessSnapshot.fromJson({
  'entitlements': [
    {'key': 'supporter', 'validFrom': 1000, 'validUntil': null},
  ],
  'permissions': <Object>[],
  'content': <Object>[],
  'limits': <Object>[],
});

CommerceCatalog _catalog() => CommerceCatalog.fromJson({
  'offers': [
    {
      'key': 'supporter',
      'name': 'Supporter',
      'description': 'Permanent cosmetics',
      'kind': 'oneTime',
      'entitlements': ['supporter'],
      'repeatable': false,
      'products': [
        {
          'provider': 'google_play',
          'providerReference': 'supporter_once',
          'displayPrice': r'$4.99',
          'currencyCode': 'USD',
        },
        {
          'provider': 'stripe',
          'providerReference': 'price_supporter',
          'displayPrice': r'$4.99',
          'currencyCode': 'USD',
        },
      ],
    },
  ],
});

class _Repository implements CommerceRepository {
  final claims = <CommercePurchaseClaim>[];

  @override
  Future<AccessSnapshot> claim(CommercePurchaseClaim claim) async {
    claims.add(claim);
    return _access();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Gateway implements PurchaseGateway {
  _Gateway(this.updates);

  @override
  final Stream<PurchaseUpdate> updates;

  @override
  String get provider => 'google_play';

  String? purchasedOffer;
  PurchaseUpdate? completedUpdate;

  @override
  Future<List<StoreProduct>> products(Set<String> providerReferences) async => [
    if (providerReferences.contains('supporter_once'))
      const StoreProduct(
        providerReference: 'supporter_once',
        displayPrice: r'$4.99',
        currencyCode: 'USD',
      ),
  ];

  @override
  Future<void> purchase({
    required String offerKey,
    required StoreProduct product,
  }) async {
    purchasedOffer = offerKey;
  }

  @override
  Future<void> restore() async {}

  @override
  Future<void> complete(PurchaseUpdate update) async {
    completedUpdate = update;
  }
}

class _Deliveries implements PurchaseDeliveryStore {
  final values = <String, PurchaseUpdate>{};

  @override
  Future<List<PurchaseUpdate>> pending(String provider) async =>
      values.values.toList();

  @override
  Future<void> put(String provider, PurchaseUpdate update) async {
    values[update.deliveryId!] = update;
  }

  @override
  Future<void> remove(String provider, String deliveryId) async {
    values.remove(deliveryId);
  }
}

void main() {
  test('loads and purchases only the active gateway product mapping', () async {
    final gateway = _Gateway(const Stream.empty());
    final service = CommerceService(_Repository(), gateway, _Deliveries());
    final catalog = _catalog();

    final products = await service.productsFor(catalog);
    expect(products.keys, ['supporter_once']);
    await service.purchase(catalog.offers.single, products);
    expect(gateway.purchasedOffer, 'supporter');
  });

  test('server-verifies completed updates before exposing access', () async {
    final repository = _Repository();
    final gateway = _Gateway(
      Stream.fromIterable([
        const PurchaseUpdate(
          offerKey: 'supporter',
          providerReference: 'supporter_once',
          state: PurchaseUpdateState.pending,
        ),
        const PurchaseUpdate(
          deliveryId: 'purchase-1',
          offerKey: 'supporter',
          providerReference: 'supporter_once',
          state: PurchaseUpdateState.purchased,
          evidence: {'purchaseToken': 'verified-remotely'},
        ),
      ]),
    );
    final deliveries = _Deliveries();
    final service = CommerceService(repository, gateway, deliveries);

    final events = await service.verifiedUpdates().toList();
    expect(events.first.access, isNull);
    expect(events.last.access?.entitlements.single.key, 'supporter');
    expect(repository.claims.single.provider, 'google_play');
    expect(
      repository.claims.single.evidence['purchaseToken'],
      'verified-remotely',
    );
    expect(gateway.completedUpdate, same(events.last.update));
    expect(deliveries.values, isEmpty);
  });

  test('completed update without evidence fails closed', () async {
    final gateway = _Gateway(
      Stream.value(
        const PurchaseUpdate(
          offerKey: 'supporter',
          providerReference: 'supporter_once',
          state: PurchaseUpdateState.purchased,
        ),
      ),
    );
    final service = CommerceService(_Repository(), gateway, _Deliveries());

    expect(service.verifiedUpdates(), emitsError(isA<StateError>()));
    expect(gateway.completedUpdate, isNull);
  });

  test('retries a persisted delivery after restart', () async {
    const pending = PurchaseUpdate(
      deliveryId: 'purchase-retry',
      offerKey: 'supporter',
      providerReference: 'supporter_once',
      state: PurchaseUpdateState.restored,
      evidence: {'purchaseToken': 'persisted'},
    );
    final deliveries = _Deliveries()..values[pending.deliveryId!] = pending;
    final repository = _Repository();
    final gateway = _Gateway(const Stream.empty());
    final service = CommerceService(repository, gateway, deliveries);

    final events = await service.verifiedUpdates().toList();

    expect(events.single.access?.entitlements.single.key, 'supporter');
    expect(gateway.completedUpdate?.deliveryId, 'purchase-retry');
    expect(deliveries.values, isEmpty);
  });
}
