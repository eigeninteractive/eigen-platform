import 'package:eigen_client/eigen_client.dart';

/// A localized storefront product returned by a platform billing SDK.
class StoreProduct {
  const StoreProduct({
    required this.providerReference,
    required this.displayPrice,
    this.currencyCode,
  });

  final String providerReference;
  final String displayPrice;
  final String? currencyCode;
}

/// The normalized state of one platform purchase update.
enum PurchaseUpdateState { pending, purchased, restored, cancelled, failed }

/// Evidence emitted by a platform billing adapter.
///
/// [evidence] is present only when the provider says a purchase was completed
/// or restored. It is still untrusted until the Worker verifies it.
class PurchaseUpdate {
  const PurchaseUpdate({
    this.deliveryId,
    required this.offerKey,
    required this.providerReference,
    required this.state,
    this.evidence,
    this.error,
  });

  /// Stable provider delivery identity, required for completed updates.
  final String? deliveryId;
  final String offerKey;
  final String providerReference;
  final PurchaseUpdateState state;
  final Map<String, Object>? evidence;
  final Object? error;
}

/// Durable outbox for completed provider deliveries awaiting full processing.
abstract interface class PurchaseDeliveryStore {
  Future<void> put(String provider, PurchaseUpdate update);

  Future<List<PurchaseUpdate>> pending(String provider);

  Future<void> remove(String provider, String deliveryId);
}

/// One way a player can buy, in this build, on this platform.
///
/// Which storefronts a build carries is an application composition decision:
/// an Android build ships the store SDK its distribution channel requires, a
/// web build ships the hosted pages its merchant accounts are set up for. The
/// server holds no routing policy, so changing that decision is an app
/// release.
///
/// The two kinds below differ in where the purchase UI lives, and that
/// difference is not cosmetic: an SDK storefront owns the transaction and must
/// be told when to settle it, while a hosted one hands control to a browser
/// and gets it back through a return URL.
abstract interface class Storefront {
  /// Key matching the provider name in the server commerce catalog.
  String get provider;
}

/// A storefront whose purchase UI is an on-device billing SDK.
///
/// Google Play is the case that shapes this: the Billing library runs the
/// purchase, reports through a stream that also replays purchases made
/// elsewhere, and requires the purchase to be settled afterwards or the money
/// is refunded.
abstract interface class PurchaseGateway implements Storefront {
  Future<List<StoreProduct>> products(Set<String> providerReferences);

  Stream<PurchaseUpdate> get updates;

  /// Starts the SDK purchase flow.
  ///
  /// [repeatable] is the offer's own flag, and it decides the store's product
  /// type: a store will not sell the same non-consumable twice, so a tip that
  /// cannot be tipped again is the wrong product type rather than a quirk to
  /// work around.
  Future<void> purchase({
    required String offerKey,
    required StoreProduct product,
    required bool repeatable,
  });

  Future<void> restore();

  /// Acknowledges or completes provider delivery after Worker verification.
  ///
  /// Implementations must be able to complete a reconstructed update from its
  /// durable evidence; retaining only an in-memory SDK object is insufficient.
  /// This method is never called for pending, cancelled, failed, or unverified
  /// updates.
  Future<void> complete(PurchaseUpdate update);
}

/// The query parameter carrying the logical offer through a hosted checkout.
///
/// A provider's return URL says what was paid for in the provider's own terms
/// — a Stripe session, a Razorpay payment — and nothing about the offer the
/// player thought they were buying, which is what a claim is made against. The
/// return URL is ours, so the offer key travels on it.
const hostedOfferQueryParameter = 'eigen_offer';

/// A storefront whose purchase UI is a provider-hosted page.
///
/// Stripe and Razorpay are these: the Worker creates a checkout URL, the
/// player leaves the app to pay on the provider's own page, and comes back
/// through [returnUrl]. Nothing is settled afterwards — the provider has
/// already taken the money — so there is no completion hook.
///
/// Leaving and returning are separate events, and on the web they are separate
/// *page loads*: a redirect to the provider unloads the app, so nothing that
/// [present] returned would still be listening. That is why recognising a
/// return is [resume]'s job and not [present]'s, and why it is safe to call
/// [resume] at startup with whatever URL the app was opened at.
abstract interface class HostedStorefront implements Storefront {
  /// Where the provider sends the player back to.
  ///
  /// The Worker requires this to be its own origin or a configured trusted
  /// client origin, and requires `http`/`https` — so a custom URI scheme will
  /// not do. On Android and iOS that means an App Link or Universal Link the
  /// system routes back into the app.
  Uri get returnUrl;

  /// Opens [checkoutUrl] and reports what can be told from here.
  ///
  /// Usually nothing: the player has left, and only the return says whether
  /// they paid. Implementations report that as [PurchaseUpdateState.pending]
  /// rather than inventing an outcome. On a platform where opening the page
  /// unloads the app, this never completes, and nothing is waiting for it.
  Future<PurchaseUpdate> present(
    Uri checkoutUrl, {
    required String offerKey,
    required String providerReference,
  });

  /// The purchase [uri] reports, if it is a return from this storefront.
  ///
  /// Returns null for any other URL — an ordinary deep link, or a return
  /// belonging to a different provider — so every hosted storefront a build
  /// carries can be offered the same URL.
  PurchaseUpdate? resume(Uri uri);
}

/// Default for applications that do not opt into commerce.
class UnavailablePurchaseGateway implements PurchaseGateway {
  const UnavailablePurchaseGateway();

  @override
  String get provider => 'unavailable';

  @override
  Stream<PurchaseUpdate> get updates => const Stream.empty();

  @override
  Future<List<StoreProduct>> products(Set<String> providerReferences) async =>
      const [];

  @override
  Future<void> purchase({
    required String offerKey,
    required StoreProduct product,
    required bool repeatable,
  }) {
    throw UnsupportedError('No purchase gateway is configured.');
  }

  @override
  Future<void> restore() {
    throw UnsupportedError('No purchase gateway is configured.');
  }

  @override
  Future<void> complete(PurchaseUpdate update) {
    throw UnsupportedError('No purchase gateway is configured.');
  }
}

/// A purchase update after server verification when evidence was available.
typedef VerifiedPurchaseUpdate = ({
  PurchaseUpdate update,
  AccessSnapshot? access,
});
