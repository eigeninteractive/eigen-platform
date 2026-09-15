import 'package:eigen_flutter/eigen_flutter.dart';
import 'package:flutter_test/flutter_test.dart';

final _returnUrl = Uri.parse('https://game.example/store/return');

/// Records what would have been opened, without opening anything.
class _Launcher implements CheckoutLauncher {
  _Launcher({this.succeeds = true});

  final bool succeeds;
  final opened = <Uri>[];

  @override
  Future<bool> open(Uri checkoutUrl) async {
    opened.add(checkoutUrl);
    return succeeds;
  }
}

Uri _returnedWith(Map<String, String> parameters) => _returnUrl.replace(
  queryParameters: {hostedOfferQueryParameter: 'supporter', ...parameters},
);

void main() {
  group('leaving for the provider', () {
    test('is pending, because leaving says nothing about paying', () async {
      final launcher = _Launcher();
      final storefront = StripeHostedStorefront(
        returnUrl: _returnUrl,
        launcher: launcher,
      );

      final update = await storefront.present(
        Uri.parse('https://checkout.stripe.com/c/pay/cs_1'),
        offerKey: 'supporter',
        providerReference: 'price_supporter',
      );

      expect(launcher.opened.single.host, 'checkout.stripe.com');
      expect(update.state, PurchaseUpdateState.pending);
      expect(update.evidence, isNull);
    });

    test('is a failure only when the page would not open at all', () async {
      final storefront = StripeHostedStorefront(
        returnUrl: _returnUrl,
        launcher: _Launcher(succeeds: false),
      );

      final update = await storefront.present(
        Uri.parse('https://checkout.stripe.com/c/pay/cs_1'),
        offerKey: 'supporter',
        providerReference: 'price_supporter',
      );

      expect(update.state, PurchaseUpdateState.failed);
    });
  });

  group('recognizing a return', () {
    test('ignores a URL that is not a return at all', () {
      final storefront = StripeHostedStorefront(
        returnUrl: _returnUrl,
        launcher: _Launcher(),
      );

      // An app's own deep links arrive here too. None of them is a purchase.
      expect(
        storefront.resume(Uri.parse('https://game.example/games/42')),
        isNull,
      );
      expect(storefront.resume(_returnUrl), isNull);
    });

    test('reads the Stripe session the adapter asked to be sent back', () {
      final storefront = StripeHostedStorefront(
        returnUrl: _returnUrl,
        launcher: _Launcher(),
      );

      final update = storefront.resume(
        _returnedWith({'session_id': 'cs_test_1'}),
      );

      expect(update?.state, PurchaseUpdateState.purchased);
      expect(update?.offerKey, 'supporter');
      expect(update?.deliveryId, 'cs_test_1');
      expect(update?.evidence, {'sessionId': 'cs_test_1'});
    });

    test('treats a Stripe return with no session as a cancellation', () {
      // The adapter puts the session placeholder on the success URL only, so a
      // return without one came back from `cancel_url`.
      final storefront = StripeHostedStorefront(
        returnUrl: _returnUrl,
        launcher: _Launcher(),
      );

      final update = storefront.resume(_returnedWith(const {}));

      expect(update?.state, PurchaseUpdateState.cancelled);
      expect(update?.evidence, isNull);
    });

    test('prefers a Razorpay subscription over the payment inside it', () {
      // The payment is the first instalment; the subscription is the thing the
      // entitlement follows.
      final storefront = RazorpayHostedStorefront(
        returnUrl: _returnUrl,
        launcher: _Launcher(),
      );

      final update = storefront.resume(
        _returnedWith({
          'razorpay_payment_id': 'pay_1',
          'razorpay_subscription_id': 'sub_1',
          'razorpay_signature': 'ignored-here',
        }),
      );

      expect(update?.evidence, {'subscriptionId': 'sub_1'});
      expect(update?.deliveryId, 'sub_1');
    });

    test('reads a Razorpay payment link return', () {
      final storefront = RazorpayHostedStorefront(
        returnUrl: _returnUrl,
        launcher: _Launcher(),
      );

      final update = storefront.resume(
        _returnedWith({
          'razorpay_payment_id': 'pay_2',
          'razorpay_payment_link_status': 'paid',
        }),
      );

      expect(update?.evidence, {'paymentId': 'pay_2'});
    });

    test('does not answer for another provider on the same return URL', () {
      // A build carrying both offers each storefront the same URL; the one it
      // does not belong to must decline rather than guess.
      final stripe = StripeHostedStorefront(
        returnUrl: _returnUrl,
        launcher: _Launcher(),
      );
      final razorpay = RazorpayHostedStorefront(
        returnUrl: _returnUrl,
        launcher: _Launcher(),
      );
      final fromRazorpay = _returnedWith({'razorpay_payment_id': 'pay_3'});

      expect(razorpay.resume(fromRazorpay)?.evidence, {'paymentId': 'pay_3'});
      // Stripe sees no session and would call it cancelled, which is why a
      // build should not give two storefronts the same return path.
      expect(stripe.resume(fromRazorpay)?.state, PurchaseUpdateState.cancelled);
      expect(razorpay.resume(_returnedWith({'session_id': 'cs_9'})), isNull);
    });
  });
}
