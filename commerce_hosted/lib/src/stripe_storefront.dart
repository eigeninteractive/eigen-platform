import 'package:eigen_flutter/adapters.dart';

import 'checkout_launcher.dart';

/// The provider key this storefront sells through.
///
/// It must match the key of the `@eigeninteractive/server/commerce/stripe`
/// adapter registered on the Worker, because that is what a claim is routed by.
const stripeProvider = 'stripe';

/// Stripe hosted Checkout behind the [HostedStorefront] port.
///
/// The Worker creates the Checkout Session — it holds the secret key, and the
/// session is bound to the account there — so this class only opens the URL and
/// reads the return. No Stripe SDK is involved, and no card data passes through
/// this process, which is the point of hosted Checkout rather than Elements.
final class StripeHostedStorefront extends HostedCheckoutStorefront {
  const StripeHostedStorefront({required super.returnUrl, super.launcher});

  @override
  String get provider => stripeProvider;

  @override
  PurchaseUpdate? recognize(Uri uri, String offerKey) {
    // Stripe substitutes this into the success URL the adapter asked for. The
    // cancel URL deliberately carries no session, so a cancelled checkout is
    // not mistaken for a completed one.
    final sessionId = uri.queryParameters['session_id'];
    if (sessionId == null || sessionId.isEmpty) {
      return PurchaseUpdate(
        offerKey: offerKey,
        providerReference: '',
        state: PurchaseUpdateState.cancelled,
      );
    }
    return PurchaseUpdate(
      deliveryId: sessionId,
      offerKey: offerKey,
      // A Stripe return names a session, not a price. The Worker reads the
      // session back and checks what it actually paid for against the offer.
      providerReference: '',
      state: PurchaseUpdateState.purchased,
      evidence: {'sessionId': sessionId},
    );
  }
}
