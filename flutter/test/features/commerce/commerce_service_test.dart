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
  final checkouts =
      <({String provider, String offerKey, String operationId})>[];
  Iterable<String>? requestedProviders;

  @override
  Future<AccessSnapshot> claim(CommercePurchaseClaim claim) async {
    claims.add(claim);
    return _access();
  }

  @override
  Future<CommerceCatalog> getCatalog({Iterable<String>? providers}) async {
    requestedProviders = providers;
    return _catalog();
  }

  @override
  Future<Uri> createCheckout({
    required String provider,
    required String offerKey,
    required Uri returnUrl,
    required String operationId,
  }) async {
    checkouts.add((
      provider: provider,
      offerKey: offerKey,
      operationId: operationId,
    ));
    return Uri.parse('https://checkout.example/$offerKey');
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
  Future<List<PurchaseUpdate>> pending(String provider) async => [
    for (final entry in values.entries)
      if (entry.key.startsWith('$provider:')) entry.value,
  ];

  @override
  Future<void> put(String provider, PurchaseUpdate update) async {
    values['$provider:${update.deliveryId}'] = update;
  }

  @override
  Future<void> remove(String provider, String deliveryId) async {
    values.remove('$provider:$deliveryId');
  }
}

/// A provider-hosted page, scripted to return whatever the test needs.
class _Hosted implements HostedStorefront {
  _Hosted(this._outcome);

  final PurchaseUpdate Function(Uri checkoutUrl) _outcome;
  final presented = <Uri>[];

  @override
  String get provider => 'stripe';

  @override
  Uri get returnUrl => Uri.parse('https://game.example/return');

  @override
  Future<PurchaseUpdate> present(
    Uri checkoutUrl, {
    required String offerKey,
    required String providerReference,
  }) async {
    presented.add(checkoutUrl);
    return _outcome(checkoutUrl);
  }
}

void main() {
  test('loads and purchases only the active gateway product mapping', () async {
    final gateway = _Gateway(const Stream.empty());
    final service = CommerceService(_Repository(), [gateway], _Deliveries());
    final catalog = _catalog();

    final products = await service.productsFor(catalog);
    expect(products.keys, ['google_play:supporter_once']);
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
    final service = CommerceService(repository, [gateway], deliveries);

    final events = await service.verifiedUpdates().take(2).toList();
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
    final service = CommerceService(_Repository(), [gateway], _Deliveries());

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
    final deliveries = _Deliveries()
      ..values['google_play:${pending.deliveryId}'] = pending;
    final repository = _Repository();
    final gateway = _Gateway(const Stream.empty());
    final service = CommerceService(repository, [gateway], deliveries);

    final events = await service.verifiedUpdates().take(1).toList();

    expect(events.single.access?.entitlements.single.key, 'supporter');
    expect(gateway.completedUpdate?.deliveryId, 'purchase-retry');
    expect(deliveries.values, isEmpty);
  });

  test('asks the Worker only for the storefronts this build carries', () async {
    final repository = _Repository();
    final service = CommerceService(repository, [
      _Gateway(const Stream.empty()),
    ], _Deliveries());

    await service.getCatalog();

    // Every other provider's price lookup is a round trip to a payment API for
    // a number this build could never render, on a request a player waits for.
    expect(repository.requestedProviders, ['google_play']);
  });

  test('prices hosted offers from the server, never from an SDK', () async {
    final hosted = _Hosted(
      (_) => const PurchaseUpdate(
        offerKey: 'supporter',
        providerReference: 'price_supporter',
        state: PurchaseUpdateState.cancelled,
      ),
    );
    final service = CommerceService(_Repository(), [hosted], _Deliveries());

    final products = await service.productsFor(_catalog());

    // A hosted page has no SDK to ask: its price arrived with the catalog.
    expect(products, isEmpty);
  });

  test('buys through the first storefront the offer is sold by', () async {
    final repository = _Repository();
    final hosted = _Hosted(
      (_) => const PurchaseUpdate(
        deliveryId: 'cs_test_1',
        offerKey: 'supporter',
        providerReference: 'price_supporter',
        state: PurchaseUpdateState.purchased,
        evidence: {'sessionId': 'cs_test_1'},
      ),
    );
    final gateway = _Gateway(const Stream.empty());
    // Hosted first: ordering the storefronts orders the preference.
    final service = CommerceService(repository, [
      hosted,
      gateway,
    ], _Deliveries());
    final catalog = _catalog();

    final updates = service.verifiedUpdates().take(1).toList();
    await service.purchase(catalog.offers.single, const {});

    expect(repository.checkouts.single.provider, 'stripe');
    expect(repository.checkouts.single.offerKey, 'supporter');
    expect(hosted.presented.single.toString(), contains('supporter'));
    // The SDK gateway was never asked, so nothing was bought twice.
    expect(gateway.purchasedOffer, isNull);
    expect((await updates).single.access?.entitlements.single.key, 'supporter');
    expect(repository.claims.single.provider, 'stripe');
    await service.dispose();
  });

  test(
    'a hosted return that settles nothing still reaches the store',
    () async {
      // A browser closed on a slow network says nothing about the money. The
      // provider webhook remains authoritative, so this must surface as an
      // unresolved update rather than a failure or a silent unlock.
      final repository = _Repository();
      final hosted = _Hosted(
        (_) => const PurchaseUpdate(
          offerKey: 'supporter',
          providerReference: 'price_supporter',
          state: PurchaseUpdateState.pending,
        ),
      );
      final deliveries = _Deliveries();
      final service = CommerceService(repository, [hosted], deliveries);

      final updates = service.verifiedUpdates().take(1).toList();
      await service.purchase(_catalog().offers.single, const {});

      expect((await updates).single.access, isNull);
      expect(repository.claims, isEmpty);
      expect(deliveries.values, isEmpty);
      await service.dispose();
    },
  );

  test('never settles a hosted purchase at an SDK', () async {
    // `complete` acknowledges a store transaction. A hosted page holds none,
    // and calling it on the wrong storefront would acknowledge someone else's.
    final hosted = _Hosted(
      (_) => const PurchaseUpdate(
        deliveryId: 'cs_test_2',
        offerKey: 'supporter',
        providerReference: 'price_supporter',
        state: PurchaseUpdateState.purchased,
        evidence: {'sessionId': 'cs_test_2'},
      ),
    );
    final gateway = _Gateway(const Stream.empty());
    final service = CommerceService(_Repository(), [
      hosted,
      gateway,
    ], _Deliveries());

    final updates = service.verifiedUpdates().take(1).toList();
    await service.purchase(_catalog().offers.single, const {});
    await updates;

    expect(gateway.completedUpdate, isNull);
    await service.dispose();
  });

  test('refuses an offer no storefront here sells', () async {
    final service = CommerceService(_Repository(), [
      _Hosted((_) => throw StateError('unreachable')),
    ], _Deliveries());
    final playOnly = CommerceCatalog.fromJson({
      'offers': [
        {
          'key': 'android_only',
          'name': 'Android only',
          'description': '',
          'kind': 'oneTime',
          'entitlements': <Object>[],
          'repeatable': false,
          'products': [
            {
              'provider': 'google_play',
              'providerReference': 'android_only',
              'displayPrice': null,
              'currencyCode': null,
            },
          ],
        },
      ],
    });

    await expectLater(
      service.purchase(playOnly.offers.single, const {}),
      throwsStateError,
    );
  });
}
