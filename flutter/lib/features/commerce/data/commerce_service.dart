import 'dart:async';

import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/features/commerce/domain/purchase_gateway.dart';

/// Joins this build's storefronts to the authoritative Worker projection.
///
/// A build carries whichever storefronts its platform and merchant setup allow
/// — a store SDK, one or more hosted pages, or both. This class is where the
/// two shapes stop differing: however a purchase was made, it arrives on
/// [verifiedUpdates] only after the Worker verified it and returned access.
class CommerceService {
  CommerceService(this._repository, this._storefronts, this._deliveries);

  final CommerceRepository _repository;
  final List<Storefront> _storefronts;
  final PurchaseDeliveryStore _deliveries;

  /// Hosted checkouts resolve as futures; this is how they join the stream the
  /// SDK gateways already publish on, so a store screen listens once.
  final StreamController<StorefrontUpdate> _hosted =
      StreamController<StorefrontUpdate>.broadcast();

  /// The last catalog read, which is the only thing that maps a storefront's
  /// product back to the logical offer a claim is made against.
  CommerceCatalog? _catalog;

  Iterable<String> get _providers =>
      _storefronts.map((storefront) => storefront.provider);

  /// The offers this build can show, priced by the storefronts it carries.
  ///
  /// Naming the providers keeps the Worker from calling payment APIs for
  /// prices no storefront here could render.
  Future<CommerceCatalog> getCatalog() async =>
      _catalog = await _repository.getCatalog(providers: _providers);

  Future<AccessSnapshot> getAccess() => _repository.getAccess();

  /// SDK-native product details, keyed `provider:providerReference`.
  ///
  /// Only [PurchaseGateway] storefronts have these. A [HostedStorefront] is
  /// priced by the provider through the server catalog, so its offers already
  /// carry a `displayPrice` and need no second round trip.
  Future<Map<String, StoreProduct>> productsFor(CommerceCatalog catalog) async {
    final entries = <String, StoreProduct>{};
    for (final gateway in _storefronts.whereType<PurchaseGateway>()) {
      final providerReferences = <String>{
        for (final offer in catalog.offers)
          for (final product in offer.products)
            if (product.provider == gateway.provider) product.providerReference,
      };
      if (providerReferences.isEmpty) continue;
      for (final product in await gateway.products(providerReferences)) {
        entries['${gateway.provider}:${product.providerReference}'] = product;
      }
    }
    return entries;
  }

  /// Starts the purchase flow for one registered logical offer.
  ///
  /// The storefront is chosen by the first one this build carries that the
  /// offer is actually sold through, so ordering the storefronts orders the
  /// preference. The result never arrives here: it arrives on
  /// [verifiedUpdates], for both kinds.
  Future<void> purchase(
    CommerceOffer offer,
    Map<String, StoreProduct> products,
  ) async {
    for (final storefront in _storefronts) {
      final mapping = offer.products
          .where((product) => product.provider == storefront.provider)
          .firstOrNull;
      if (mapping == null) continue;
      switch (storefront) {
        case final PurchaseGateway gateway:
          final product =
              products['${gateway.provider}:${mapping.providerReference}'];
          if (product == null) {
            throw StateError(
              'Storefront did not return ${mapping.providerReference}.',
            );
          }
          await gateway.purchase(
            offerKey: offer.key,
            product: product,
            repeatable: offer.repeatable,
          );
          return;
        case final HostedStorefront hosted:
          await _presentHosted(hosted, offer, mapping.providerReference);
          return;
      }
    }
    throw StateError(
      'Offer ${offer.key} is not sold through ${_providers.join(', ')}.',
    );
  }

  Future<void> _presentHosted(
    HostedStorefront hosted,
    CommerceOffer offer,
    String providerReference,
  ) async {
    // A fresh identity per attempt. Retrying after an ambiguous failure
    // therefore opens a second provider session rather than resolving the
    // first; an abandoned session expires and costs nothing, while reusing an
    // identity across a changed offer is refused outright.
    final checkout = await _repository.createCheckout(
      provider: hosted.provider,
      offerKey: offer.key,
      // The provider's return says what was paid for in its own terms and
      // nothing about the offer, which is what the claim is made against.
      returnUrl: hosted.returnUrl.replace(
        queryParameters: {
          ...hosted.returnUrl.queryParameters,
          hostedOfferQueryParameter: offer.key,
        },
      ),
      operationId: newCheckoutOperationId(),
    );
    await _publishHosted(
      hosted,
      await hosted.present(
        checkout,
        offerKey: offer.key,
        providerReference: providerReference,
      ),
    );
  }

  /// Offers [uri] to every hosted storefront this build carries.
  ///
  /// Call it with the URL the app was opened at, and again whenever a deep
  /// link arrives: on the web a checkout redirect unloads the app entirely, so
  /// a return is an ordinary cold start that happens to carry a purchase. A
  /// URL no storefront recognizes changes nothing.
  ///
  /// Returns true when a storefront claimed the URL.
  Future<bool> resumeFrom(Uri uri) async {
    for (final hosted in _storefronts.whereType<HostedStorefront>()) {
      final update = hosted.resume(uri);
      if (update == null) continue;
      await _publishHosted(hosted, update);
      return true;
    }
    return false;
  }

  Future<void> _publishHosted(
    HostedStorefront hosted,
    PurchaseUpdate update,
  ) async {
    // Durable before it is announced: a claim interrupted between here and the
    // Worker is retried from the outbox on the next start, exactly as an SDK
    // delivery is.
    if (update.state == PurchaseUpdateState.purchased &&
        update.deliveryId != null &&
        update.evidence != null) {
      await _deliveries.put(hosted.provider, update);
    }
    _hosted.add((storefront: hosted, update: update));
  }

  /// Restores at every SDK gateway; results still pass through
  /// [verifiedUpdates].
  ///
  /// Hosted storefronts have nothing to restore: their purchases were never
  /// held on the device, and the account's entitlements are already whatever
  /// [getAccess] says.
  Future<void> restore() async {
    for (final gateway in _storefronts.whereType<PurchaseGateway>()) {
      await gateway.restore();
    }
  }

  /// Converts storefront updates into server-authoritative access snapshots.
  ///
  /// Pending, cancelled, and failed events carry no access. A purchased or
  /// restored event without evidence is an adapter bug and surfaces as an
  /// error rather than unlocking locally.
  Stream<VerifiedPurchaseUpdate> verifiedUpdates() async* {
    for (final storefront in _storefronts) {
      for (final update in await _deliveries.pending(storefront.provider)) {
        yield await _verifyAndComplete(storefront, update);
      }
    }
    await for (final event in _storefrontUpdates()) {
      final update = event.update;
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
      await _deliveries.put(event.storefront.provider, update);
      yield await _verifyAndComplete(event.storefront, update);
    }
  }

  Future<VerifiedPurchaseUpdate> _verifyAndComplete(
    Storefront storefront,
    PurchaseUpdate update,
  ) async {
    final evidence = update.evidence;
    final deliveryId = update.deliveryId;
    if (evidence == null || deliveryId == null) {
      throw StateError('A pending delivery is missing its durable fields.');
    }
    final access = await _repository.claim(
      CommercePurchaseClaim(
        provider: storefront.provider,
        offerKey: await _offerKeyFor(storefront, update),
        evidence: evidence,
      ),
    );
    // Only an SDK holds an unsettled transaction. A hosted page has none, and
    // Play refunds a purchase this step forgets.
    if (storefront case final PurchaseGateway gateway) {
      await gateway.complete(update);
    }
    await _deliveries.remove(storefront.provider, deliveryId);
    return (update: update, access: access);
  }

  /// The logical offer [update] paid for.
  ///
  /// A store SDK reports its own product identifier and knows nothing about
  /// offers, so the mapping lives in the catalog and nowhere else. It is
  /// fetched if this service has not read one yet: a purchase restored at
  /// startup can arrive before any store screen has asked for the catalog, and
  /// claiming it with a product id would fail as an unknown offer.
  Future<String> _offerKeyFor(
    Storefront storefront,
    PurchaseUpdate update,
  ) async {
    final catalog = _catalog ?? await getCatalog();
    for (final offer in catalog.offers) {
      for (final product in offer.products) {
        if (product.provider == storefront.provider &&
            product.providerReference == update.providerReference) {
          return offer.key;
        }
      }
    }
    // Nothing better to say than what the storefront said. A hosted return
    // carries the offer key itself, so this is the honest answer there; for an
    // SDK it is a product id, and the Worker will reject it as an unknown
    // offer, which is the right failure.
    return update.offerKey;
  }

  /// Every storefront's updates as one stream.
  ///
  /// Merged by hand rather than with `package:async` so the Flutter package
  /// takes no dependency for one function. Subscriptions start on listen and
  /// are cancelled together, so nothing is held open by a store screen that
  /// has gone away.
  Stream<StorefrontUpdate> _storefrontUpdates() {
    final controller = StreamController<StorefrontUpdate>();
    final subscriptions = <StreamSubscription<void>>[];
    controller.onListen = () {
      for (final gateway in _storefronts.whereType<PurchaseGateway>()) {
        subscriptions.add(
          gateway.updates.listen(
            (update) => controller.add((storefront: gateway, update: update)),
            onError: controller.addError,
          ),
        );
      }
      subscriptions.add(
        _hosted.stream.listen(controller.add, onError: controller.addError),
      );
    };
    controller.onCancel = () async {
      for (final subscription in subscriptions) {
        await subscription.cancel();
      }
      subscriptions.clear();
    };
    return controller.stream;
  }

  Future<void> dispose() => _hosted.close();
}

/// One storefront update, carrying the storefront that produced it.
typedef StorefrontUpdate = ({Storefront storefront, PurchaseUpdate update});
