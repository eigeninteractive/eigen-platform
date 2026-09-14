// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Platform billing boundary. Commerce applications override this provider.

@ProviderFor(purchaseGateway)
final purchaseGatewayProvider = PurchaseGatewayProvider._();

/// Platform billing boundary. Commerce applications override this provider.

final class PurchaseGatewayProvider
    extends
        $FunctionalProvider<PurchaseGateway, PurchaseGateway, PurchaseGateway>
    with $Provider<PurchaseGateway> {
  /// Platform billing boundary. Commerce applications override this provider.
  PurchaseGatewayProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'purchaseGatewayProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$purchaseGatewayHash();

  @$internal
  @override
  $ProviderElement<PurchaseGateway> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  PurchaseGateway create(Ref ref) {
    return purchaseGateway(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PurchaseGateway value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PurchaseGateway>(value),
    );
  }
}

String _$purchaseGatewayHash() => r'61a7161e9b3054d12d4e164d929f4a5bb9877072';

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

/// Provider-neutral coordinator joining SDK updates to server verification.

@ProviderFor(commerceService)
final commerceServiceProvider = CommerceServiceProvider._();

/// Provider-neutral coordinator joining SDK updates to server verification.

final class CommerceServiceProvider
    extends
        $FunctionalProvider<CommerceService, CommerceService, CommerceService>
    with $Provider<CommerceService> {
  /// Provider-neutral coordinator joining SDK updates to server verification.
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

String _$commerceServiceHash() => r'7107394e2615cd3b5b7f3eb151f0abf40e9cf508';
