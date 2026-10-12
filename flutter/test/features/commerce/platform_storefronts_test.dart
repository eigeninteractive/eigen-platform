import 'package:eigen_flutter/features/commerce/domain/platform_storefronts.dart';
import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

class _Storefront implements Storefront {
  const _Storefront(this.provider);

  @override
  final String provider;
}

void main() {
  const play = _Storefront('google_play');
  const stripe = _Storefront('stripe');
  const razorpay = _Storefront('razorpay');

  List<Storefront> on(TargetPlatform platform, {bool isWeb = false}) {
    debugDefaultTargetPlatformOverride = platform;
    try {
      return platformStorefronts(
        android: const [play],
        web: const [stripe],
        desktop: const [razorpay],
        isWeb: isWeb,
      );
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  }

  test('sells through Play in the Android app', () {
    expect(on(TargetPlatform.android), [play]);
  });

  test('sells through hosted pages on the web, whatever the device', () {
    expect(on(TargetPlatform.android, isWeb: true), [stripe]);
    expect(on(TargetPlatform.iOS, isWeb: true), [stripe]);
  });

  test('sells through the desktop storefronts on Windows and Linux', () {
    expect(on(TargetPlatform.windows), [razorpay]);
    expect(on(TargetPlatform.linux), [razorpay]);
  });

  test('sells nothing in an Apple app, so the store does not appear', () {
    // Apple requires its own in-app purchase for digital goods, and a hosted
    // checkout in its place is grounds for rejecting the app.
    expect(on(TargetPlatform.iOS), isEmpty);
    expect(on(TargetPlatform.macOS), isEmpty);
  });
}
