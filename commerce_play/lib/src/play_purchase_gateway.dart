import 'dart:async';

import 'package:eigen_flutter/adapters.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/billing_client_wrappers.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

/// The provider key this gateway sells through.
///
/// It must match the key of the `@eigeninteractive/server/commerce/google-play`
/// adapter registered on the Worker, because that is what a claim is routed by.
const googlePlayProvider = 'google_play';

/// Google Play Billing behind the [PurchaseGateway] port.
///
/// Play is the reason the port has a [complete] step at all: a purchase that is
/// not acknowledged within three days is automatically refunded, and the money
/// goes back whether or not the player got what they bought. So the order
/// matters and is not this class's to choose — `CommerceService` verifies with
/// the Worker, commits the entitlement, and only then calls [complete].
///
/// Everything here is evidence, never permission. A `purchased` update is a
/// claim that Play says something was bought; the Worker re-reads it from the
/// Android Publisher API before any of it becomes access.
class PlayPurchaseGateway implements PurchaseGateway {
  PlayPurchaseGateway({required this.accountId, InAppPurchase? billing})
    : _billing = billing ?? InAppPurchase.instance;

  /// The Eigen account to bind a purchase to, read at purchase time.
  ///
  /// Play carries it as `obfuscatedAccountId` and the Worker's adapter reads it
  /// back as `obfuscatedExternalAccountId`, which is how a developer
  /// notification — which names no Eigen account — is attributed to one. Read
  /// late rather than captured, because the signed-in account outlives no
  /// session in particular.
  final String Function() accountId;
  final InAppPurchase _billing;

  /// What Play last said about each product, so a purchase can name the SDK
  /// object Play expects rather than an identifier we invented.
  final Map<String, ProductDetails> _details = <String, ProductDetails>{};

  /// Live deliveries keyed by purchase token. Play re-delivers anything
  /// unacknowledged on every start, so this fills itself; [complete] falls back
  /// to reconstruction for the window before it has.
  final Map<String, PurchaseDetails> _live = <String, PurchaseDetails>{};

  @override
  String get provider => googlePlayProvider;

  @override
  Future<List<StoreProduct>> products(Set<String> providerReferences) async {
    if (providerReferences.isEmpty) return const [];
    if (!await _billing.isAvailable()) return const [];
    final response = await _billing.queryProductDetails(providerReferences);
    for (final details in response.productDetails) {
      _details[details.id] = details;
    }
    // `notFoundIDs` is not an error here. A catalog may list an offer this
    // build's Play listing does not carry yet, and a store screen showing the
    // rest is better than one showing nothing.
    return [
      for (final details in response.productDetails)
        StoreProduct(
          providerReference: details.id,
          displayPrice: details.price,
          currencyCode: details.currencyCode,
        ),
    ];
  }

  @override
  Stream<PurchaseUpdate> get updates => _billing.purchaseStream.asyncExpand(
    (deliveries) => Stream.fromIterable(deliveries.map(_updateOf)),
  );

  @override
  Future<void> purchase({
    required String offerKey,
    required StoreProduct product,
    required bool repeatable,
  }) async {
    final details = _details[product.providerReference];
    if (details == null) {
      throw StateError(
        'Play has no product details for ${product.providerReference}; load products first.',
      );
    }
    final parameters = PurchaseParam(
      productDetails: details,
      applicationUserName: accountId(),
    );
    // A repeatable offer is a consumable: Play will not sell the same
    // non-consumable twice, so a tip that cannot be tipped again is not a
    // storefront quirk to work around but the wrong product type.
    final started = repeatable
        ? await _billing.buyConsumable(purchaseParam: parameters)
        : await _billing.buyNonConsumable(purchaseParam: parameters);
    if (!started) {
      throw StateError(
        'Play declined to start the purchase flow for ${product.providerReference}.',
      );
    }
  }

  @override
  Future<void> restore() =>
      _billing.restorePurchases(applicationUserName: accountId());

  @override
  Future<void> complete(PurchaseUpdate update) async {
    final token = update.evidence?['purchaseToken'];
    if (token is! String || token.isEmpty) {
      throw StateError(
        'A Play delivery cannot be settled without its purchase token.',
      );
    }
    // The live object when this run has seen it, and otherwise one rebuilt from
    // the token alone: an outbox entry written before a crash must still be
    // settleable, and Play's three-day refund does not wait for the stream to
    // re-deliver.
    await _billing.completePurchase(
      _live[token] ?? _reconstruct(update, token),
    );
    _live.remove(token);
  }

  PurchaseUpdate _updateOf(PurchaseDetails details) {
    final token = details.verificationData.serverVerificationData;
    if (details.status == PurchaseStatus.purchased ||
        details.status == PurchaseStatus.restored) {
      _live[token] = details;
    }
    return PurchaseUpdate(
      // Play's order id is the transaction's public identity, and the one the
      // Worker records. It is absent until a pending purchase completes, and
      // the token is the only stable handle before then.
      deliveryId: details.purchaseID ?? token,
      // The storefront knows the product, not the offer. `CommerceService`
      // resolves the offer against the catalog, which is the only thing that
      // holds the mapping.
      offerKey: details.productID,
      providerReference: details.productID,
      state: switch (details.status) {
        PurchaseStatus.purchased => PurchaseUpdateState.purchased,
        PurchaseStatus.restored => PurchaseUpdateState.restored,
        PurchaseStatus.pending => PurchaseUpdateState.pending,
        PurchaseStatus.canceled => PurchaseUpdateState.cancelled,
        PurchaseStatus.error => PurchaseUpdateState.failed,
      },
      // Only a completed delivery carries evidence. A pending one has a token
      // that names a purchase nobody has paid for yet, and sending it would ask
      // the Worker to verify an absence.
      evidence:
          details.status == PurchaseStatus.purchased ||
              details.status == PurchaseStatus.restored
          ? {'purchaseToken': token}
          : null,
      error: details.error,
    );
  }

  /// A delivery rebuilt from durable evidence.
  ///
  /// `completePurchase` reads exactly two things from it — whether Play already
  /// acknowledged the purchase, and the token to acknowledge — so the rest is
  /// filled with what the update carries. `isAcknowledged: false` is the safe
  /// value: acknowledging twice is accepted, and skipping it is a refund.
  PurchaseDetails _reconstruct(PurchaseUpdate update, String token) =>
      GooglePlayPurchaseDetails(
        purchaseID: update.deliveryId,
        productID: update.providerReference,
        verificationData: PurchaseVerificationData(
          localVerificationData: '',
          serverVerificationData: token,
          source: googlePlayProvider,
        ),
        transactionDate: null,
        status: PurchaseStatus.purchased,
        billingClientPurchase: PurchaseWrapper(
          orderId: update.deliveryId ?? '',
          packageName: '',
          purchaseTime: 0,
          purchaseToken: token,
          signature: '',
          products: [update.providerReference],
          isAutoRenewing: false,
          originalJson: '',
          isAcknowledged: false,
          purchaseState: PurchaseStateWrapper.purchased,
        ),
      );
}
