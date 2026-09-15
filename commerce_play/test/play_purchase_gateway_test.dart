import 'dart:async';

import 'package:eigen_commerce_play/eigen_commerce_play.dart';
import 'package:eigen_flutter/adapters.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

/// Play, scripted. Records what the gateway asked it to do.
class _Billing implements InAppPurchase {
  _Billing({this.available = true, this.products = const []});

  final bool available;
  final List<ProductDetails> products;
  final _purchases = StreamController<List<PurchaseDetails>>.broadcast();
  final completed = <PurchaseDetails>[];
  final consumable = <String>[];
  final nonConsumable = <String>[];
  final restoredFor = <String?>[];
  bool startSucceeds = true;

  void deliver(List<PurchaseDetails> deliveries) => _purchases.add(deliveries);

  @override
  Stream<List<PurchaseDetails>> get purchaseStream => _purchases.stream;

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<ProductDetailsResponse> queryProductDetails(
    Set<String> identifiers,
  ) async => ProductDetailsResponse(
    productDetails: products.where((p) => identifiers.contains(p.id)).toList(),
    notFoundIDs: identifiers
        .where((id) => !products.any((p) => p.id == id))
        .toList(),
  );

  @override
  Future<bool> buyConsumable({
    required PurchaseParam purchaseParam,
    bool autoConsume = true,
  }) async {
    consumable.add(purchaseParam.productDetails.id);
    return startSucceeds;
  }

  @override
  Future<bool> buyNonConsumable({required PurchaseParam purchaseParam}) async {
    nonConsumable.add(purchaseParam.productDetails.id);
    return startSucceeds;
  }

  @override
  Future<void> completePurchase(PurchaseDetails purchase) async =>
      completed.add(purchase);

  @override
  Future<void> restorePurchases({String? applicationUserName}) async =>
      restoredFor.add(applicationUserName);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

ProductDetails _product(String id) => ProductDetails(
  id: id,
  title: 'Supporter',
  description: 'Permanent cosmetics',
  price: r'$4.99',
  rawPrice: 4.99,
  currencyCode: 'USD',
);

PurchaseDetails _delivery(
  String token, {
  PurchaseStatus status = PurchaseStatus.purchased,
  String? orderId = 'GPA.1',
}) => PurchaseDetails(
  purchaseID: orderId,
  productID: 'supporter_once',
  verificationData: PurchaseVerificationData(
    localVerificationData: '{}',
    serverVerificationData: token,
    source: 'google_play',
  ),
  transactionDate: '1699000000000',
  status: status,
);

void main() {
  test(
    'offers the account to Play, so a notification can be attributed',
    () async {
      // Play carries this as obfuscatedAccountId, and a developer notification
      // names no Eigen account. Read late: the signed-in account changes.
      var account = 'alice';
      final billing = _Billing(products: [_product('supporter_once')]);
      final gateway = PlayPurchaseGateway(
        accountId: () => account,
        billing: billing,
      );

      await gateway.products({'supporter_once'});
      await gateway.purchase(
        offerKey: 'supporter',
        product: const StoreProduct(
          providerReference: 'supporter_once',
          displayPrice: r'$4.99',
        ),
        repeatable: false,
      );
      account = 'bob';
      await gateway.restore();

      expect(billing.restoredFor, ['bob']);
    },
  );

  test('sells a repeatable offer as a consumable', () async {
    // Play will not sell the same non-consumable twice, so a tip bought as one
    // can never be tipped again.
    final billing = _Billing(products: [_product('supporter_once')]);
    final gateway = PlayPurchaseGateway(
      accountId: () => 'alice',
      billing: billing,
    );
    await gateway.products({'supporter_once'});
    const product = StoreProduct(
      providerReference: 'supporter_once',
      displayPrice: r'$4.99',
    );

    await gateway.purchase(offerKey: 'tip', product: product, repeatable: true);
    await gateway.purchase(
      offerKey: 'supporter',
      product: product,
      repeatable: false,
    );

    expect(billing.consumable, ['supporter_once']);
    expect(billing.nonConsumable, ['supporter_once']);
  });

  test('refuses to buy a product Play never described', () async {
    final gateway = PlayPurchaseGateway(
      accountId: () => 'alice',
      billing: _Billing(),
    );

    await expectLater(
      gateway.purchase(
        offerKey: 'supporter',
        product: const StoreProduct(
          providerReference: 'supporter_once',
          displayPrice: r'$4.99',
        ),
        repeatable: false,
      ),
      throwsStateError,
    );
  });

  test(
    'sends evidence only for a delivery that was actually paid for',
    () async {
      final billing = _Billing();
      final gateway = PlayPurchaseGateway(
        accountId: () => 'alice',
        billing: billing,
      );
      final updates = gateway.updates.take(3).toList();

      billing.deliver([
        _delivery('tok_pending', status: PurchaseStatus.pending, orderId: null),
        _delivery('tok_paid'),
        _delivery('tok_cancelled', status: PurchaseStatus.canceled),
      ]);

      final seen = await updates;
      expect(seen[0].state, PurchaseUpdateState.pending);
      // A pending purchase has a token naming something nobody has paid for;
      // sending it would ask the Worker to verify an absence.
      expect(seen[0].evidence, isNull);
      // Play has no order id until a pending purchase completes, and the outbox
      // still needs a durable identity for it.
      expect(seen[0].deliveryId, 'tok_pending');
      expect(seen[1].state, PurchaseUpdateState.purchased);
      expect(seen[1].evidence, {'purchaseToken': 'tok_paid'});
      expect(seen[1].deliveryId, 'GPA.1');
      expect(seen[2].state, PurchaseUpdateState.cancelled);
      expect(seen[2].evidence, isNull);
    },
  );

  test('settles the live delivery when this run has seen it', () async {
    final billing = _Billing();
    final gateway = PlayPurchaseGateway(
      accountId: () => 'alice',
      billing: billing,
    );
    final updates = gateway.updates.take(1).toList();
    final live = _delivery('tok_live');
    billing.deliver([live]);
    final update = (await updates).single;

    await gateway.complete(update);

    expect(billing.completed.single, same(live));
  });

  test('settles from durable evidence alone after a restart', () async {
    // The outbox survives a crash; the SDK object does not. Play refunds an
    // unacknowledged purchase after three days, so "wait for Play to
    // re-deliver" is not a settlement strategy.
    final billing = _Billing();
    final gateway = PlayPurchaseGateway(
      accountId: () => 'alice',
      billing: billing,
    );

    await gateway.complete(
      const PurchaseUpdate(
        deliveryId: 'GPA.7',
        offerKey: 'supporter',
        providerReference: 'supporter_once',
        state: PurchaseUpdateState.purchased,
        evidence: {'purchaseToken': 'tok_from_outbox'},
      ),
    );

    final settled = billing.completed.single as GooglePlayPurchaseDetails;
    expect(settled.verificationData.serverVerificationData, 'tok_from_outbox');
    // Acknowledging twice is accepted; skipping it is a refund.
    expect(settled.billingClientPurchase.isAcknowledged, isFalse);
    expect(settled.pendingCompletePurchase, isTrue);
  });

  test('will not settle a delivery carrying no token', () async {
    final gateway = PlayPurchaseGateway(
      accountId: () => 'alice',
      billing: _Billing(),
    );

    await expectLater(
      gateway.complete(
        const PurchaseUpdate(
          deliveryId: 'GPA.8',
          offerKey: 'supporter',
          providerReference: 'supporter_once',
          state: PurchaseUpdateState.purchased,
        ),
      ),
      throwsStateError,
    );
  });

  test('shows the products Play knows rather than none at all', () async {
    // A catalog may list an offer this build's Play listing does not carry yet.
    final billing = _Billing(products: [_product('supporter_once')]);
    final gateway = PlayPurchaseGateway(
      accountId: () => 'alice',
      billing: billing,
    );

    final products = await gateway.products({
      'supporter_once',
      'not_listed_yet',
    });

    expect(products.single.providerReference, 'supporter_once');
    expect(products.single.displayPrice, r'$4.99');
    expect(products.single.currencyCode, 'USD');
  });

  test('has nothing to sell where billing is unavailable', () async {
    final gateway = PlayPurchaseGateway(
      accountId: () => 'alice',
      billing: _Billing(
        available: false,
        products: [_product('supporter_once')],
      ),
    );

    expect(await gateway.products({'supporter_once'}), isEmpty);
  });
}
