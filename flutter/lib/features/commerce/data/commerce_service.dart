import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';

/// Joins a platform billing adapter to the authoritative Worker projection.
class CommerceService {
  CommerceService(this._repository, this._gateway, this._deliveries);

  final CommerceRepository _repository;
  final PurchaseGateway _gateway;
  final PurchaseDeliveryStore _deliveries;

  Future<CommerceCatalog> getCatalog() => _repository.getCatalog();

  Future<AccessSnapshot> getAccess() => _repository.getAccess();

  /// Loads SDK-native details only for products registered to this gateway.
  Future<Map<String, StoreProduct>> productsFor(CommerceCatalog catalog) async {
    final providerReferences = <String>{
      for (final offer in catalog.offers)
        for (final product in offer.products)
          if (product.provider == _gateway.provider) product.providerReference,
    };
    final products = await _gateway.products(providerReferences);
    return {for (final product in products) product.providerReference: product};
  }

  /// Starts the platform purchase flow for one registered logical offer.
  Future<void> purchase(
    CommerceOffer offer,
    Map<String, StoreProduct> products,
  ) async {
    final mapping = offer.products
        .where((product) => product.provider == _gateway.provider)
        .firstOrNull;
    if (mapping == null) {
      throw StateError(
        'Offer ${offer.key} is unavailable from ${_gateway.provider}.',
      );
    }
    final product = products[mapping.providerReference];
    if (product == null) {
      throw StateError('Storefront did not return ${mapping.providerReference}.');
    }
    await _gateway.purchase(offerKey: offer.key, product: product);
  }

  /// Restores at the SDK; resulting updates still pass through [verifiedUpdates].
  Future<void> restore() => _gateway.restore();

  /// Converts provider updates into server-authoritative access snapshots.
  ///
  /// Pending, cancelled, and failed events carry no access. A purchased or
  /// restored event without evidence is an adapter bug and surfaces as an
  /// error rather than unlocking locally.
  Stream<VerifiedPurchaseUpdate> verifiedUpdates() async* {
    for (final update in await _deliveries.pending(_gateway.provider)) {
      yield await _verifyAndComplete(update);
    }
    await for (final update in _gateway.updates) {
      if (update.state != PurchaseUpdateState.purchased &&
          update.state != PurchaseUpdateState.restored) {
        yield (update: update, access: null);
        continue;
      }
      final evidence = update.evidence;
      final deliveryId = update.deliveryId;
      if (evidence == null || deliveryId == null) {
        throw StateError(
          'Completed purchase ${update.providerReference} has no durable identity or provider evidence.',
        );
      }
      await _deliveries.put(_gateway.provider, update);
      yield await _verifyAndComplete(update);
    }
  }

  Future<VerifiedPurchaseUpdate> _verifyAndComplete(
    PurchaseUpdate update,
  ) async {
    final evidence = update.evidence;
    final deliveryId = update.deliveryId;
    if (evidence == null || deliveryId == null) {
      throw StateError('A pending delivery is missing its durable fields.');
    }
    final access = await _repository.claim(
      CommercePurchaseClaim(
        provider: _gateway.provider,
        offerKey: update.offerKey,
        evidence: evidence,
      ),
    );
    await _gateway.complete(update);
    await _deliveries.remove(_gateway.provider, deliveryId);
    return (update: update, access: access);
  }
}
