// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The storefronts this build can buy through, in preference order.
///
/// Empty by default: a game that sells nothing overrides nothing. A commerce
/// application overrides this at its composition root with the storefronts its
/// platform allows — typically a [PurchaseGateway] for the store SDK on
/// Android, and a [HostedStorefront] per merchant account on the web. There is
/// no server-side routing policy, so this list is the decision, and changing
/// it is an app release.

@ProviderFor(storefronts)
final storefrontsProvider = StorefrontsProvider._();

/// The storefronts this build can buy through, in preference order.
///
/// Empty by default: a game that sells nothing overrides nothing. A commerce
/// application overrides this at its composition root with the storefronts its
/// platform allows — typically a [PurchaseGateway] for the store SDK on
/// Android, and a [HostedStorefront] per merchant account on the web. There is
/// no server-side routing policy, so this list is the decision, and changing
/// it is an app release.

final class StorefrontsProvider
    extends
        $FunctionalProvider<
          List<Storefront>,
          List<Storefront>,
          List<Storefront>
        >
    with $Provider<List<Storefront>> {
  /// The storefronts this build can buy through, in preference order.
  ///
  /// Empty by default: a game that sells nothing overrides nothing. A commerce
  /// application overrides this at its composition root with the storefronts its
  /// platform allows — typically a [PurchaseGateway] for the store SDK on
  /// Android, and a [HostedStorefront] per merchant account on the web. There is
  /// no server-side routing policy, so this list is the decision, and changing
  /// it is an app release.
  StorefrontsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'storefrontsProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$storefrontsHash();

  @$internal
  @override
  $ProviderElement<List<Storefront>> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  List<Storefront> create(Ref ref) {
    return storefronts(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(List<Storefront> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<List<Storefront>>(value),
    );
  }
}

String _$storefrontsHash() => r'8d984cfc2cf4c3eee2b1c4a50c26c3efaf63998c';

/// Pure-Dart access to the Worker's commerce API.

@ProviderFor(commerceRepository)
final commerceRepositoryProvider = CommerceRepositoryProvider._();

/// Pure-Dart access to the Worker's commerce API.

final class CommerceRepositoryProvider
    extends
        $FunctionalProvider<
          CommerceRepository,
          CommerceRepository,
          CommerceRepository
        >
    with $Provider<CommerceRepository> {
  /// Pure-Dart access to the Worker's commerce API.
  CommerceRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'commerceRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$commerceRepositoryHash();

  @$internal
  @override
  $ProviderElement<CommerceRepository> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  CommerceRepository create(Ref ref) {
    return commerceRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(CommerceRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<CommerceRepository>(value),
    );
  }
}

String _$commerceRepositoryHash() =>
    r'e231d2c5d2639b3cd6691063baab09529e0ce460';

/// Provider-neutral coordinator joining storefront updates to server
/// verification.

@ProviderFor(commerceService)
final commerceServiceProvider = CommerceServiceProvider._();

/// Provider-neutral coordinator joining storefront updates to server
/// verification.

final class CommerceServiceProvider
    extends
        $FunctionalProvider<CommerceService, CommerceService, CommerceService>
    with $Provider<CommerceService> {
  /// Provider-neutral coordinator joining storefront updates to server
  /// verification.
  CommerceServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'commerceServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$commerceServiceHash();

  @$internal
  @override
  $ProviderElement<CommerceService> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  CommerceService create(Ref ref) {
    return commerceService(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(CommerceService value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<CommerceService>(value),
    );
  }
}

String _$commerceServiceHash() => r'6212e4daf0254edf27fb9a3abd64ddb6453a4283';
