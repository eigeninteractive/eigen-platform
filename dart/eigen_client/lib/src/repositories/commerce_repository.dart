import 'package:dio/dio.dart';
import 'package:eigen_api/eigen_api.dart';

import '../api/engine_call.dart';
import '../domain/operation_identity.dart';

/// Provider evidence for one registered logical offer.
///
/// [evidence] is opaque to the client runtime. The matching server adapter
/// verifies it directly with the provider before any entitlement becomes
/// active.
class CommercePurchaseClaim {
  const CommercePurchaseClaim({
    required this.provider,
    required this.offerKey,
    required this.evidence,
  });

  final String provider;
  final String offerKey;
  final Map<String, Object> evidence;

  CommerceClaim toWire() =>
      CommerceClaim(provider: provider, offerKey: offerKey, evidence: evidence);
}

/// Provider-neutral commerce access to the Eigen Worker.
///
/// Store SDK updates are only purchase evidence. Call [claim] or [restore] and
/// trust the returned server snapshot before unlocking anything locally.
class CommerceRepository {
  CommerceRepository(Dio http) : _api = CommerceApi(http);

  final CommerceApi _api;

  /// The game's registered offers and provider-localized product details.
  ///
  /// [providers] names the storefronts this build can actually buy through,
  /// comma-separated. Passing them keeps the Worker from calling payment APIs
  /// for prices this client cannot display, on a request a player is waiting
  /// for. Omit it only to inspect every registered storefront at once.
  ///
  /// An offer with no [CommerceProduct] for any named provider is still
  /// listed: it exists, and it is not purchasable from here.
  Future<CommerceCatalog> getCatalog({Iterable<String>? providers}) =>
      engineData(
        () => _api.getCommerceCatalog(
          provider: providers == null ? null : providers.join(','),
        ),
      );

  /// The account's current entitlements, capabilities, content, and limits.
  Future<AccessSnapshot> getAccess() =>
      engineData(() => _api.getCommerceAccess());

  /// Verifies one provider purchase and returns freshly resolved access.
  Future<AccessSnapshot> claim(CommercePurchaseClaim claim) => engineData(
    () => _api.claimCommercePurchase(commerceClaim: claim.toWire()),
  );

  /// Restores one or more provider purchases in one account-level operation.
  Future<AccessSnapshot> restore(Iterable<CommercePurchaseClaim> claims) {
    final values = claims.toList(growable: false);
    if (values.isEmpty) {
      throw ArgumentError.value(values, 'claims', 'must not be empty');
    }
    return engineData(
      () => _api.restoreCommercePurchases(
        commerceRestore: CommerceRestore(
          claims: values.map((claim) => claim.toWire()).toList(),
        ),
      ),
    );
  }

  /// Creates a hosted checkout URL for providers such as Stripe.
  ///
  /// [operationId] identifies this checkout attempt. Mint it with
  /// [newCheckoutOperationId] and reuse it after an ambiguous transport
  /// failure: the same identity returns the checkout the server already
  /// opened, so a retry cannot leave a second session open. Reusing it for a
  /// different [offerKey] or [returnUrl] is refused.
  Future<Uri> createCheckout({
    required String provider,
    required String offerKey,
    required Uri returnUrl,
    required String operationId,
  }) async {
    final result = await engineData(
      () => _api.createCommerceCheckout(
        commerceCheckoutRequest: CommerceCheckoutRequest(
          provider: provider,
          offerKey: offerKey,
          returnUrl: returnUrl.toString(),
          operationId: operationId,
        ),
      ),
    );
    return Uri.parse(result.url);
  }

  /// Creates a provider-hosted subscription-management URL.
  Future<Uri> createManagement({
    required String provider,
    required Uri returnUrl,
  }) async {
    final result = await engineData(
      () => _api.createCommerceManagement(
        commerceManagementRequest: CommerceManagementRequest(
          provider: provider,
          returnUrl: returnUrl.toString(),
        ),
      ),
    );
    return Uri.parse(result.url);
  }
}
