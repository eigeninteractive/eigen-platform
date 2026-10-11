import 'dart:async';

import 'package:eigen_flutter/shell_support.dart';
// The Android implementation directly, not the `in_app_purchase` umbrella: the
// umbrella also pulls in StoreKit, which would link an Apple payments
// framework into every iOS build of every game the shell ships, including the
// ones that sell nothing.
import 'package:in_app_purchase_android/billing_client_wrappers.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:in_app_purchase_platform_interface/in_app_purchase_platform_interface.dart';

/// The provider key this gateway sells through.
///
/// It must match the key of the `@eigeninteractive/server/commerce/google-play`
/// adapter registered on the Worker, because that is what a claim is routed by.
const googlePlayProvider = 'google_play';

/// The Play Console offer tag that marks an offer this gateway may launch.
///
/// Play hides an offer from a player it is not eligible for only when Play
/// decides eligibility — a new-customer free trial, say. A developer-determined
/// offer (win-back, retention, upgrade) is returned to every player, so nothing
/// on the device can tell who it was meant for. Launching only tagged offers
/// leaves that call with whoever set them up.
const defaultPlayLaunchTag = 'eigen-launch';

/// The Play subscriptions the device's Google account holds now.
typedef PlayOwnedPurchases = Future<List<GooglePlayPurchaseDetails>> Function();

/// The product a catalog reference names.
///
/// A one-time product's reference is its product id. A subscription's is
/// `{productId}:{basePlanId}`, the form the Worker's Play adapter defines,
/// because monthly and yearly are two base plans of one product and a catalog
/// sells them as two offers.
String _productOf(String providerReference) =>
    providerReference.split(':').first;

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
  PlayPurchaseGateway({
    required this.accountId,
    this.launchTag = defaultPlayLaunchTag,
    InAppPurchasePlatform? billing,
    PlayOwnedPurchases? ownedPurchases,
  }) : _billing = billing ?? _androidPlatform(),
       _ownedPurchases = ownedPurchases ?? _ownedOnDevice;

  /// The umbrella package registers the Android implementation on startup, and
  /// this does not use the umbrella. Registering here rather than asking an
  /// application to remember turns a runtime failure into nothing at all.
  static InAppPurchasePlatform _androidPlatform() {
    if (!_registered) {
      InAppPurchaseAndroidPlatform.registerPlatform();
      _registered = true;
    }
    return InAppPurchasePlatform.instance;
  }

  static bool _registered = false;

  /// The Eigen account to bind a purchase to, read at purchase time.
  ///
  /// Play carries it as `obfuscatedAccountId` and the Worker's adapter reads it
  /// back as `obfuscatedExternalAccountId`, which is how a developer
  /// notification — which names no Eigen account — is attributed to one. Read
  /// late rather than captured, because the signed-in account outlives no
  /// session in particular.
  final String Function() accountId;

  /// The offer tag that lets an offer be launched; see [defaultPlayLaunchTag].
  final String launchTag;
  final InAppPurchasePlatform _billing;
  final PlayOwnedPurchases _ownedPurchases;

  /// Through the Android addition the platform registered, which is the one
  /// place the plugin exposes `queryPurchasesAsync`. A failed read is no
  /// subscriptions: the purchase then goes ahead as a new one, and Play
  /// refuses it itself if the account does hold the product.
  static Future<List<GooglePlayPurchaseDetails>> _ownedOnDevice() async {
    final addition = InAppPurchasePlatformAddition.instance;
    if (addition is! InAppPurchaseAndroidPlatformAddition) return const [];
    final response = await addition.queryPastPurchases();
    return response.error == null ? response.pastPurchases : const [];
  }

  /// What Play last said about each catalog reference, so a purchase can name
  /// the SDK object Play expects — for a subscription, the one carrying the
  /// offer token — rather than an identifier we invented.
  final Map<String, ProductDetails> _details = <String, ProductDetails>{};

  /// Live deliveries keyed by purchase token. Play re-delivers anything
  /// unacknowledged on every start, so this fills itself; [complete] falls back
  /// to reconstruction for the window before it has.
  final Map<String, PurchaseDetails> _live = <String, PurchaseDetails>{};

  @override
  String get provider => googlePlayProvider;

  /// Play's products for [providerReferences], one per reference.
  ///
  /// Play describes a subscription as one entry per offer: each base plan, and
  /// each offer on it — a trial, an introductory price, a win-back discount.
  /// A reference names a base plan. What is sold under it is the cheapest of
  /// its offers tagged [launchTag] that Play still returns for this player, and
  /// otherwise the base plan itself; see [defaultPlayLaunchTag] for why an
  /// untagged offer is never launched.
  @override
  Future<List<StoreProduct>> products(Set<String> providerReferences) async {
    if (providerReferences.isEmpty) return const [];
    if (!await _billing.isAvailable()) return const [];
    final response = await _billing.queryProductDetails({
      for (final reference in providerReferences) _productOf(reference),
    });
    final byReference = <String, List<ProductDetails>>{};
    for (final details in response.productDetails) {
      final reference = _referenceOf(details);
      if (providerReferences.contains(reference)) {
        (byReference[reference] ??= []).add(details);
      }
    }
    final chosen = <String, ProductDetails>{
      for (final MapEntry(key: reference, value: entries)
          in byReference.entries)
        reference: ?_launchable(entries),
    };
    _details.addAll(chosen);
    // `notFoundIDs` is not an error here. A catalog may list an offer this
    // build's Play listing does not carry yet, and a store screen showing the
    // rest is better than one showing nothing.
    return [
      for (final MapEntry(key: reference, value: details) in chosen.entries)
        _storeProduct(reference, details),
    ];
  }

  /// The entry to sell from one base plan's entries.
  ///
  /// An offer inherits its base plan's tags, so only the tags it carries
  /// beyond the base plan's count: tagging a base plan launches none of its
  /// offers. Cheapest is by the lowest price any phase charges, which puts a
  /// free trial ahead of a discount.
  ProductDetails? _launchable(List<ProductDetails> entries) {
    final base = entries.where((d) => _offerOf(d)?.offerId == null).firstOrNull;
    final inherited = _offerOf(base)?.offerTags.toSet() ?? const <String>{};
    final tagged = [
      for (final details in entries)
        if (_offerOf(details) case final offer?
            when offer.offerId != null &&
                offer.offerTags.contains(launchTag) &&
                !inherited.contains(launchTag))
          details,
    ];
    if (tagged.isEmpty) return base;
    int lowest(ProductDetails details) =>
        _offerOf(details)!.pricingPhases
            .map((phase) => phase.priceAmountMicros)
            .reduce((a, b) => a < b ? a : b);
    return tagged.reduce((a, b) => lowest(b) < lowest(a) ? b : a);
  }

  /// The regular price, and any introductory phases ahead of it. Play prices
  /// an offer entry at its first phase, which for a trial is "Free" — true of
  /// the first week, and not what the subscription costs.
  static StoreProduct _storeProduct(String reference, ProductDetails details) {
    final phases = _offerOf(details)?.pricingPhases ?? const [];
    final regular = phases
        .where(
          (phase) => phase.recurrenceMode == RecurrenceMode.infiniteRecurring,
        )
        .lastOrNull;
    return StoreProduct(
      providerReference: reference,
      displayPrice: regular?.formattedPrice ?? details.price,
      currencyCode: details.currencyCode,
      introductoryPrices: [
        for (final phase in phases)
          if (!identical(phase, regular))
            IntroductoryPrice(
              displayPrice: phase.formattedPrice,
              billingPeriod: phase.billingPeriod,
              cycles: phase.billingCycleCount,
            ),
      ],
    );
  }

  /// The catalog reference [details] sells under.
  static String _referenceOf(ProductDetails details) {
    final offer = _offerOf(details);
    return offer == null ? details.id : '${details.id}:${offer.basePlanId}';
  }

  static SubscriptionOfferDetailsWrapper? _offerOf(ProductDetails? details) {
    if (details is! GooglePlayProductDetails) return null;
    final index = details.subscriptionIndex;
    if (index == null) return null;
    return details.productDetails.subscriptionOfferDetails?[index];
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
    final parameters = GooglePlayPurchaseParam(
      productDetails: details,
      applicationUserName: accountId(),
      changeSubscriptionParam: await _replacing(details),
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

  /// The subscription this purchase changes the plan of, if the account holds
  /// one: another base plan of the same product.
  ///
  /// Play will not sell a second plan of a product the account already holds;
  /// moving between them is a replacement of the old purchase. How it is
  /// charged — now, or from the next renewal — is left unset, so Play applies
  /// the default replacement mode the game's Play Console sets for the
  /// product, which for plans of one subscription is the only place that
  /// choice belongs. Another product is a separate subscription and is bought
  /// alongside.
  Future<ChangeSubscriptionParam?> _replacing(ProductDetails details) async {
    if (_offerOf(details) == null) return null;
    for (final owned in await _ownedPurchases()) {
      if (owned.productID == details.id) {
        return ChangeSubscriptionParam(oldPurchaseDetails: owned);
      }
    }
    return null;
  }

  @override
  Future<void> restore() =>
      _billing.restorePurchases(applicationUserName: accountId());

  /// Play's purchase names the product, never a subscription's base plan, so
  /// every plan of the product covers it. The Worker reads the plan from Play.
  @override
  bool covers(String providerReference, PurchaseUpdate update) =>
      _productOf(providerReference) == update.providerReference;

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
      // The storefront knows the product, not the offer, and for a
      // subscription not even the base plan. `CommerceService` resolves an
      // offer against the catalog through [covers], and the Worker records the
      // plan Play reports.
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
