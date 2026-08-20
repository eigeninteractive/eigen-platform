// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_installation_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Singleton [DeviceInstallationRepository] instance.

@ProviderFor(deviceInstallationRepository)
final deviceInstallationRepositoryProvider =
    DeviceInstallationRepositoryProvider._();

/// Singleton [DeviceInstallationRepository] instance.

final class DeviceInstallationRepositoryProvider
    extends
        $FunctionalProvider<
          DeviceInstallationRepository,
          DeviceInstallationRepository,
          DeviceInstallationRepository
        >
    with $Provider<DeviceInstallationRepository> {
  /// Singleton [DeviceInstallationRepository] instance.
  DeviceInstallationRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'deviceInstallationRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$deviceInstallationRepositoryHash();

  @$internal
  @override
  $ProviderElement<DeviceInstallationRepository> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  DeviceInstallationRepository create(Ref ref) {
    return deviceInstallationRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(DeviceInstallationRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<DeviceInstallationRepository>(value),
    );
  }
}

String _$deviceInstallationRepositoryHash() =>
    r'fcfe96f105d464fdaa9723781760ef9d6e12edad';
