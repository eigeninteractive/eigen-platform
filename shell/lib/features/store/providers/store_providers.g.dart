// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'store_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Whether this build can sell anything at all.
///
/// A game that configures no storefront gets no store route, no catalog fetch,
/// and no local database opened to discover that — the list is a composition
/// decision the application made before any of this ran.

@ProviderFor(storeAvailable)
final storeAvailableProvider = StoreAvailableProvider._();

/// Whether this build can sell anything at all.
///
/// A game that configures no storefront gets no store route, no catalog fetch,
/// and no local database opened to discover that — the list is a composition
/// decision the application made before any of this ran.

final class StoreAvailableProvider extends $FunctionalProvider<bool, bool, bool>
    with $Provider<bool> {
  /// Whether this build can sell anything at all.
  ///
  /// A game that configures no storefront gets no store route, no catalog fetch,
  /// and no local database opened to discover that — the list is a composition
  /// decision the application made before any of this ran.
  StoreAvailableProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'storeAvailableProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$storeAvailableHash();

  @$internal
  @override
  $ProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  bool create(Ref ref) {
    return storeAvailable(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(bool value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<bool>(value),
    );
  }
}

String _$storeAvailableHash() => r'dfbe7247f559b49088279ab5c85a551e3bbd0697';

/// The offers this build can buy, priced by the storefronts it carries.

@ProviderFor(storeCatalog)
final storeCatalogProvider = StoreCatalogProvider._();

/// The offers this build can buy, priced by the storefronts it carries.

final class StoreCatalogProvider
    extends
        $FunctionalProvider<
          AsyncValue<CommerceCatalog>,
          CommerceCatalog,
          FutureOr<CommerceCatalog>
        >
    with $FutureModifier<CommerceCatalog>, $FutureProvider<CommerceCatalog> {
  /// The offers this build can buy, priced by the storefronts it carries.
  StoreCatalogProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'storeCatalogProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$storeCatalogHash();

  @$internal
  @override
  $FutureProviderElement<CommerceCatalog> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<CommerceCatalog> create(Ref ref) {
    return storeCatalog(ref);
  }
}

String _$storeCatalogHash() => r'3cc82162737d486d8a42669bffd9effee7c9dde9';

/// The account's entitlements, capabilities, content, and allowances.
///
/// Authoritative and server-resolved: the client mirrors it for presentation
/// and never decides access from it.

@ProviderFor(storeAccess)
final storeAccessProvider = StoreAccessProvider._();

/// The account's entitlements, capabilities, content, and allowances.
///
/// Authoritative and server-resolved: the client mirrors it for presentation
/// and never decides access from it.

final class StoreAccessProvider
    extends
        $FunctionalProvider<
          AsyncValue<AccessSnapshot>,
          AccessSnapshot,
          FutureOr<AccessSnapshot>
        >
    with $FutureModifier<AccessSnapshot>, $FutureProvider<AccessSnapshot> {
  /// The account's entitlements, capabilities, content, and allowances.
  ///
  /// Authoritative and server-resolved: the client mirrors it for presentation
  /// and never decides access from it.
  StoreAccessProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'storeAccessProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$storeAccessHash();

  @$internal
  @override
  $FutureProviderElement<AccessSnapshot> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<AccessSnapshot> create(Ref ref) {
    return storeAccess(ref);
  }
}

String _$storeAccessHash() => r'272634b560ebf3c8cb3adf6f45e06c8c07a938a5';

/// SDK-native product details, for the storefronts that have any.
///
/// A hosted page is priced by the provider through the server catalog, so this
/// is empty for a build that only carries those, and the catalog's own
/// `displayPrice` is what the store shows.

@ProviderFor(storeProducts)
final storeProductsProvider = StoreProductsProvider._();

/// SDK-native product details, for the storefronts that have any.
///
/// A hosted page is priced by the provider through the server catalog, so this
/// is empty for a build that only carries those, and the catalog's own
/// `displayPrice` is what the store shows.

final class StoreProductsProvider
    extends
        $FunctionalProvider<
          AsyncValue<Map<String, StoreProduct>>,
          Map<String, StoreProduct>,
          FutureOr<Map<String, StoreProduct>>
        >
    with
        $FutureModifier<Map<String, StoreProduct>>,
        $FutureProvider<Map<String, StoreProduct>> {
  /// SDK-native product details, for the storefronts that have any.
  ///
  /// A hosted page is priced by the provider through the server catalog, so this
  /// is empty for a build that only carries those, and the catalog's own
  /// `displayPrice` is what the store shows.
  StoreProductsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'storeProductsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$storeProductsHash();

  @$internal
  @override
  $FutureProviderElement<Map<String, StoreProduct>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<Map<String, StoreProduct>> create(Ref ref) {
    return storeProducts(ref);
  }
}

String _$storeProductsHash() => r'94dec35a940ca53732b420d05e8635e451684e52';
