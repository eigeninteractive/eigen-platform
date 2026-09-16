import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart' show WidgetRef;
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

/// The account's access as far as it is actually known, for marking pickers.
///
/// Null while it loads, when it failed, and whenever this build sells nothing.
/// [storeAccess] answers an empty snapshot in that last case without asking the
/// server, and an empty snapshot taken as fact would mark every paid opponent
/// locked for an account that may already own it.
AccessSnapshot? knownAccess(WidgetRef ref) => ref.watch(storeAvailableProvider)
    ? ref.watch(storeAccessProvider).value
    : null;

/// Whether [access] is known not to include seating a bot in [tier].
///
/// The rule is the engine's `capabilityAllows` for `bot.use`: every bot belongs
/// to exactly one tier, and a grant covers only the tier it names. An unknown
/// [access] is not a lock.
///
/// Presentation only. The server decides when it seats the bot; this just stops
/// a paid opponent looking free until then. It applies to server seating alone:
/// a game played on the device is not priced, so the untimed picker never asks.
bool seatingLocked(AccessSnapshot? access, String tier) {
  if (access == null) return false;
  return !access.permissions.any(
    (grant) =>
        grant.kind == AccessCapabilityKindEnum.botPeriodUse &&
        grant.tier == tier,
  );
}
