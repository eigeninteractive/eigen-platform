import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/store/providers/store_providers.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/container.dart';

/// A hosted storefront that is never opened; only its presence matters here.
class _Hosted implements HostedStorefront {
  @override
  String get provider => 'stripe';

  @override
  Uri get returnUrl => Uri.parse('https://game.example/return');

  @override
  Future<PurchaseUpdate> present(
    Uri checkoutUrl, {
    required String offerKey,
    required String providerReference,
  }) async => throw UnimplementedError();

  @override
  PurchaseUpdate? resume(Uri uri) => null;
}

void main() {
  test(
    'a build that sells nothing reads no catalog and opens no database',
    () async {
      // The default storefront list is empty, and `commerceServiceProvider`
      // needs a local database. Discovering "nothing is for sale" must not cost
      // one, so the short-circuit is the behaviour, not an optimization.
      final container = makeContainer();

      expect(container.read(storeAvailableProvider), isFalse);
      expect(
        (await container.read(storeCatalogProvider.future)).offers,
        isEmpty,
      );
      expect(
        (await container.read(storeAccessProvider.future)).entitlements,
        isEmpty,
      );
      expect(await container.read(storeProductsProvider.future), isEmpty);
    },
  );

  test('a build carrying a storefront has a store', () {
    final container = makeContainer(
      overrides: [
        storefrontsProvider.overrideWithValue([_Hosted()]),
      ],
    );

    expect(container.read(storeAvailableProvider), isTrue);
  });
}
