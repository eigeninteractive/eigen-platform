import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'store_providers.g.dart';

/// Whether this build can sell anything at all.
///
/// A game that configures no storefront gets no store route, no catalog fetch,
/// and no local database opened to discover that — the list is a composition
/// decision the application made before any of this ran.
@riverpod
bool storeAvailable(Ref ref) => ref.watch(storefrontsProvider).isNotEmpty;

/// The offers this build can buy, priced by the storefronts it carries.
@riverpod
Future<CommerceCatalog> storeCatalog(Ref ref) async {
  if (!ref.watch(storeAvailableProvider)) {
    return CommerceCatalog(offers: const []);
  }
  return ref.watch(commerceServiceProvider).getCatalog();
}

/// The account's entitlements, capabilities, content, and allowances.
///
/// Authoritative and server-resolved: the client mirrors it for presentation
/// and never decides access from it.
@riverpod
Future<AccessSnapshot> storeAccess(Ref ref) async {
  if (!ref.watch(storeAvailableProvider)) {
    return AccessSnapshot(
      entitlements: const [],
      permissions: const [],
      content: const [],
      limits: const [],
    );
  }
  return ref.watch(commerceServiceProvider).getAccess();
}

/// SDK-native product details, for the storefronts that have any.
///
/// A hosted page is priced by the provider through the server catalog, so this
/// is empty for a build that only carries those, and the catalog's own
/// `displayPrice` is what the store shows.
@riverpod
Future<Map<String, StoreProduct>> storeProducts(Ref ref) async {
  final catalog = await ref.watch(storeCatalogProvider.future);
  if (catalog.offers.isEmpty) return const {};
  return ref.watch(commerceServiceProvider).productsFor(catalog);
}
