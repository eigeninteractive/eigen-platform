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

/// Platform purchase boundary implemented by Android and web adapters.
abstract interface class PurchaseGateway {
  /// Key matching the provider name in the server commerce catalog.
  String get provider;

  Future<List<StoreProduct>> products(Set<String> providerReferences);

  Stream<PurchaseUpdate> get updates;

  Future<void> purchase({
    required String offerKey,
    required StoreProduct product,
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

/// Default for applications that do not opt into commerce.
class UnavailablePurchaseGateway implements PurchaseGateway {
  const UnavailablePurchaseGateway();

  @override
  String get provider => 'unavailable';

  @override
  Stream<PurchaseUpdate> get updates => const Stream.empty();

  @override
  Future<List<StoreProduct>> products(Set<String> providerReferences) async => const [];

  @override
  Future<void> purchase({
    required String offerKey,
    required StoreProduct product,
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
