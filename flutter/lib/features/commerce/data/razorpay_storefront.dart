import '../domain/purchase_gateway.dart';
import 'hosted_storefront.dart';

/// The provider key this storefront sells through.
///
/// It must match the key of the `@eigeninteractive/server/commerce/razorpay`
/// adapter registered on the Worker, because that is what a claim is routed by.
const razorpayProvider = 'razorpay';

/// Razorpay hosted checkout behind the [HostedStorefront] port.
///
/// Razorpay has no Checkout Session: a one-time sale is a Payment Link and a
/// recurring one is a subscription, and the Worker creates whichever the offer
/// calls for. Both send the player to a Razorpay-hosted page and back with the
/// purchase named in the query, which is the only thing read here.
final class RazorpayHostedStorefront extends HostedCheckoutStorefront {
  const RazorpayHostedStorefront({
    required super.returnUrl,
    required super.launcher,
  });

  @override
  String get provider => razorpayProvider;

  @override
  PurchaseUpdate? recognize(Uri uri, String offerKey) {
    final parameters = uri.queryParameters;
    // A subscription answers for itself: its id names a recurring arrangement
    // the payment is only the first instalment of, so it is the better handle
    // when both are present.
    final subscriptionId = parameters['razorpay_subscription_id'];
    final paymentId = parameters['razorpay_payment_id'];
    if ((subscriptionId == null || subscriptionId.isEmpty) &&
        (paymentId == null || paymentId.isEmpty)) {
      // A Payment Link can come back explicitly unpaid; anything else with no
      // identifier at all is a return this storefront cannot speak for.
      return parameters['razorpay_payment_link_status'] == null
          ? null
          : PurchaseUpdate(
              offerKey: offerKey,
              providerReference: '',
              state: PurchaseUpdateState.cancelled,
            );
    }
    return PurchaseUpdate(
      deliveryId: subscriptionId ?? paymentId,
      offerKey: offerKey,
      providerReference: '',
      state: PurchaseUpdateState.purchased,
      // The Worker's adapter re-reads whichever of these it is given. The
      // signature Razorpay also returns is deliberately ignored: verifying it
      // here would prove only that this device holds a public key, and the
      // Worker verifies against Razorpay itself.
      evidence: subscriptionId != null && subscriptionId.isNotEmpty
          ? {'subscriptionId': subscriptionId}
          : {'paymentId': paymentId!},
    );
  }
}
