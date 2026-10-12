import 'dart:async';

import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/commerce/data/play_purchase_gateway.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';

/// Play, scripted. Records what the gateway asked it to do.
class _Billing implements InAppPurchasePlatform {
  _Billing({this.available = true, this.products = const []});

  final bool available;
  final List<ProductDetails> products;
  final _purchases = StreamController<List<PurchaseDetails>>.broadcast();
  final completed = <PurchaseDetails>[];
  final consumable = <String>[];
  final nonConsumable = <String>[];
  final offerTokens = <String?>[];
  final params = <PurchaseParam>[];
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
    params.add(purchaseParam);
    final details = purchaseParam.productDetails;
    offerTokens.add(
      details is GooglePlayProductDetails ? details.offerToken : null,
    );
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

/// One pricing phase of a Play offer.
typedef _Phase = ({String price, int micros, String period, int cycles});

const _regular = (price: r'$4.99', micros: 4990000, period: 'P1M', cycles: 0);

/// One Play subscription product as the plugin reports it: one entry per
/// offer, each naming its base plan. An offer's tags include its base plan's,
/// as Play reports them; the last phase is the regular, recurring price.
List<ProductDetails> _subscription(
  String id,
  List<
    ({String basePlan, String? offer, List<String> tags, List<_Phase> phases})
  >
  offers,
) => GooglePlayProductDetails.fromProductDetails(
  ProductDetailsWrapper(
    description: 'Analysis and archive',
    name: 'Pro',
    productId: id,
    productType: ProductType.subs,
    title: 'Pro',
    subscriptionOfferDetails: [
      for (final offer in offers)
        SubscriptionOfferDetailsWrapper(
          basePlanId: offer.basePlan,
          offerId: offer.offer,
          offerTags: offer.tags,
          offerIdToken: 'token-${offer.basePlan}-${offer.offer ?? 'base'}',
          pricingPhases: [
            for (final (index, phase) in offer.phases.indexed)
              PricingPhaseWrapper(
                billingCycleCount: phase.cycles,
                billingPeriod: phase.period,
                formattedPrice: phase.price,
                priceAmountMicros: phase.micros,
                priceCurrencyCode: 'USD',
                recurrenceMode: index == offer.phases.length - 1
                    ? RecurrenceMode.infiniteRecurring
                    : RecurrenceMode.finiteRecurring,
              ),
          ],
        ),
    ],
  ),
);

/// A base plan, or an offer on it, at [price] then the regular price.
({String basePlan, String? offer, List<String> tags, List<_Phase> phases})
_plan(
  String basePlan, {
  String? offer,
  List<String> tags = const [],
  _Phase? intro,
  _Phase regular = _regular,
}) => (basePlan: basePlan, offer: offer, tags: tags, phases: [?intro, regular]);

const _yearly = (price: r'$39.99', micros: 39990000, period: 'P1Y', cycles: 0);
const _freeWeek = (price: 'Free', micros: 0, period: 'P1W', cycles: 1);
const _cheapMonths = (
  price: r'$0.99',
  micros: 990000,
  period: 'P1M',
  cycles: 3,
);

/// A subscription the device's Google account already holds.
GooglePlayPurchaseDetails _owned(String productId, String token) =>
    GooglePlayPurchaseDetails.fromPurchase(
      PurchaseWrapper(
        orderId: 'GPA.owned',
        packageName: 'com.example.game',
        purchaseTime: 0,
        purchaseToken: token,
        signature: '',
        products: [productId],
        isAutoRenewing: true,
        originalJson: '{}',
        isAcknowledged: true,
        purchaseState: PurchaseStateWrapper.purchased,
      ),
    ).single;

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
  test('offers the account it is given to Play, so a notification can be attributed', () async {
    // Play carries this as obfuscatedAccountId, and a developer notification
    // names no Eigen account.
    final billing = _Billing(products: [_product('supporter_once')]);
    final gateway = PlayPurchaseGateway(billing: billing);

    await gateway.products({'supporter_once'});
    await gateway.purchase(
      accountId: 'alice',
      offerKey: 'supporter',
      product: const StoreProduct(
        providerReference: 'supporter_once',
        displayPrice: r'$4.99',
      ),
      repeatable: false,
    );
    await gateway.restore(accountId: 'bob');

    expect(billing.params.single.applicationUserName, 'alice');
    expect(billing.restoredFor, ['bob']);
  });

  test('sells a repeatable offer as a consumable', () async {
    // Play will not sell the same non-consumable twice, so a tip bought as one
    // can never be tipped again.
    final billing = _Billing(products: [_product('supporter_once')]);
    final gateway = PlayPurchaseGateway(billing: billing);
    await gateway.products({'supporter_once'});
    const product = StoreProduct(
      providerReference: 'supporter_once',
      displayPrice: r'$4.99',
    );

    await gateway.purchase(
      accountId: 'alice',
      offerKey: 'tip',
      product: product,
      repeatable: true,
    );
    await gateway.purchase(
      accountId: 'alice',
      offerKey: 'supporter',
      product: product,
      repeatable: false,
    );

    expect(billing.consumable, ['supporter_once']);
    expect(billing.nonConsumable, ['supporter_once']);
  });

  test('refuses to buy a product Play never described', () async {
    final gateway = PlayPurchaseGateway(billing: _Billing());

    await expectLater(
      gateway.purchase(
        accountId: 'alice',
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
      final gateway = PlayPurchaseGateway(billing: billing);
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
    final gateway = PlayPurchaseGateway(billing: billing);
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
    final gateway = PlayPurchaseGateway(billing: billing);

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
    final gateway = PlayPurchaseGateway(billing: _Billing());

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
    final gateway = PlayPurchaseGateway(billing: billing);

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
      billing: _Billing(
        available: false,
        products: [_product('supporter_once')],
      ),
    );

    expect(await gateway.products({'supporter_once'}), isEmpty);
  });

  group('subscriptions, which Play sells by base plan', () {
    final pro = _subscription('pro', [
      _plan('monthly'),
      _plan('monthly', offer: 'trial', intro: _freeWeek),
      _plan('yearly', regular: _yearly),
    ]);

    PlayPurchaseGateway gateway(
      _Billing billing, {
      List<GooglePlayPurchaseDetails> owned = const [],
    }) => PlayPurchaseGateway(
      billing: billing,
      ownedPurchases: () async => owned,
    );

    Future<List<StoreProduct>> buyAll(
      PlayPurchaseGateway gateway,
      Set<String> references,
    ) async {
      final products = await gateway.products(references);
      for (final product in products) {
        await gateway.purchase(
          accountId: 'alice',
          offerKey: 'pro',
          product: product,
          repeatable: false,
        );
      }
      return products;
    }

    test(
      'prices each base plan the catalog names at the base plan itself',
      () async {
        final products = await gateway(_Billing(products: pro))
            .products({'pro:monthly', 'pro:yearly'});

        expect(
          {
            for (final product in products)
              product.providerReference: product.displayPrice,
          },
          {'pro:monthly': r'$4.99', 'pro:yearly': r'$39.99'},
        );
        expect(products.expand((p) => p.introductoryPrices), isEmpty);
      },
    );

    test('never launches an offer that is not tagged for launch', () async {
      // Play returns developer-determined offers (win-back, retention) to every
      // player and leaves eligibility to the app; picking the cheapest would
      // sell a price meant for a few to everyone.
      final billing = _Billing(
        products: _subscription('pro', [
          _plan(
            'yearly',
            offer: 'winback',
            intro: _cheapMonths,
            regular: _yearly,
          ),
          _plan('yearly', regular: _yearly),
          _plan('monthly', offer: 'trial', intro: _freeWeek),
          _plan('monthly'),
        ]),
      );

      await buyAll(gateway(billing), {'pro:monthly', 'pro:yearly'});

      expect(
        billing.offerTokens,
        unorderedEquals(['token-monthly-base', 'token-yearly-base']),
      );
    });

    test(
      'launches the cheapest tagged offer, priced at what it renews at',
      () async {
        final billing = _Billing(
          products: _subscription('pro', [
            _plan('monthly'),
            _plan(
              'monthly',
              offer: 'intro',
              tags: [defaultPlayLaunchTag],
              intro: _cheapMonths,
            ),
            _plan(
              'monthly',
              offer: 'trial',
              tags: [defaultPlayLaunchTag],
              intro: _freeWeek,
            ),
            _plan('monthly', offer: 'winback', intro: _freeWeek),
          ]),
        );

        final products = await buyAll(gateway(billing), {'pro:monthly'});

        expect(billing.offerTokens, ['token-monthly-trial']);
        final product = products.single;
        // Play prices an offer at its first phase: "Free" is true of the
        // first week, and not what the subscription costs.
        expect(product.displayPrice, r'$4.99');
        expect(product.introductoryPrices.single.displayPrice, 'Free');
        expect(product.introductoryPrices.single.billingPeriod, 'P1W');
        expect(product.introductoryPrices.single.cycles, 1);
      },
    );

    test('reads a launch tag on the base plan as no offer\'s', () async {
      // Offers inherit their base plan's tags. Tagging the plan must not
      // launch every offer on it, the win-back among them.
      final billing = _Billing(
        products: _subscription('pro', [
          _plan('monthly', tags: [defaultPlayLaunchTag]),
          _plan(
            'monthly',
            offer: 'winback',
            tags: [defaultPlayLaunchTag],
            intro: _freeWeek,
          ),
        ]),
      );

      await buyAll(gateway(billing), {'pro:monthly'});

      expect(billing.offerTokens, ['token-monthly-base']);
    });

    test('takes the launch tag the application names', () async {
      final billing = _Billing(
        products: _subscription('pro', [
          _plan('monthly'),
          _plan('monthly', offer: 'trial', tags: ['spring'], intro: _freeWeek),
        ]),
      );
      final spring = PlayPurchaseGateway(
        launchTag: 'spring',
        billing: billing,
        ownedPurchases: () async => const [],
      );

      await buyAll(spring, {'pro:monthly'});

      expect(billing.offerTokens, ['token-monthly-trial']);
    });

    test('leaves out a base plan the catalog does not sell', () async {
      final products = await gateway(_Billing(products: pro))
          .products({'pro:yearly'});

      expect(products.map((product) => product.providerReference), [
        'pro:yearly',
      ]);
    });

    test(
      'changes the plan of a subscription the account holds, as Play requires',
      () async {
        // Play will not sell a second plan of a product the account holds.
        final billing = _Billing(products: pro);

        await buyAll(gateway(billing, owned: [_owned('pro', 'tok_monthly')]), {
          'pro:yearly',
        });

        final change = (billing.params.single as GooglePlayPurchaseParam)
            .changeSubscriptionParam!;
        expect(
          change.oldPurchaseDetails.verificationData.serverVerificationData,
          'tok_monthly',
        );
        // Unset, so Play applies the replacement mode the game's Play Console
        // sets: when the new price is charged is that console's call.
        expect(change.replacementMode, isNull);
      },
    );

    test('buys another product alongside the one the account holds', () async {
      final billing = _Billing(products: pro);

      await buyAll(gateway(billing, owned: [_owned('themes', 'tok_themes')]), {
        'pro:yearly',
      });

      expect(
        (billing.params.single as GooglePlayPurchaseParam)
            .changeSubscriptionParam,
        isNull,
      );
    });

    test('never asks what is owned to sell a one-time product', () async {
      var asked = false;
      final billing = _Billing(products: [_product('supporter_once')]);
      final gateway = PlayPurchaseGateway(
        billing: billing,
        ownedPurchases: () async {
          asked = true;
          return const [];
        },
      );

      await buyAll(gateway, {'supporter_once'});

      expect(asked, isFalse);
    });

    test(
      'lets every plan of the product cover a purchase Play reports by product',
      () {
        // Play's purchase names the product, never the base plan; the Worker
        // reads the plan back from Play and records that one.
        final gateway = PlayPurchaseGateway(billing: _Billing());
        const update = PurchaseUpdate(
          offerKey: 'pro',
          providerReference: 'pro',
          state: PurchaseUpdateState.restored,
        );

        expect(gateway.covers('pro:monthly', update), isTrue);
        expect(gateway.covers('pro:yearly', update), isTrue);
        expect(gateway.covers('pro', update), isTrue);
        expect(gateway.covers('promo:monthly', update), isFalse);
        expect(gateway.covers('supporter_once', update), isFalse);
      },
    );
  });
}
