// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'engine_api_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The app-wide HTTP client for the engine: the data layer's single backend
/// handle.
///
/// Only repositories and data services may watch this or the API providers
/// below; everything above them consumes domain types. Enforced by
/// `test/core/architecture/api_isolation_test.dart`.
///
/// The base URL is the origin only: every generated route already carries its
/// `/api/engine` prefix.
///
/// The generated `EigenApi` facade is deliberately not used, but not because it
/// can't take this Dio. It can (`EigenApi(dio: ..., interceptors: const [])`
/// installs none of its own). The reason is the split below: each repository
/// depends on the one narrow `*Api` it needs, so a fake in a test is that one
/// resource, not the whole surface. The facade would hand every repository all
/// of them.

@ProviderFor(engineDio)
final engineDioProvider = EngineDioProvider._();

/// The app-wide HTTP client for the engine: the data layer's single backend
/// handle.
///
/// Only repositories and data services may watch this or the API providers
/// below; everything above them consumes domain types. Enforced by
/// `test/core/architecture/api_isolation_test.dart`.
///
/// The base URL is the origin only: every generated route already carries its
/// `/api/engine` prefix.
///
/// The generated `EigenApi` facade is deliberately not used, but not because it
/// can't take this Dio. It can (`EigenApi(dio: ..., interceptors: const [])`
/// installs none of its own). The reason is the split below: each repository
/// depends on the one narrow `*Api` it needs, so a fake in a test is that one
/// resource, not the whole surface. The facade would hand every repository all
/// of them.

final class EngineDioProvider extends $FunctionalProvider<Dio, Dio, Dio>
    with $Provider<Dio> {
  /// The app-wide HTTP client for the engine: the data layer's single backend
  /// handle.
  ///
  /// Only repositories and data services may watch this or the API providers
  /// below; everything above them consumes domain types. Enforced by
  /// `test/core/architecture/api_isolation_test.dart`.
  ///
  /// The base URL is the origin only: every generated route already carries its
  /// `/api/engine` prefix.
  ///
  /// The generated `EigenApi` facade is deliberately not used, but not because it
  /// can't take this Dio. It can (`EigenApi(dio: ..., interceptors: const [])`
  /// installs none of its own). The reason is the split below: each repository
  /// depends on the one narrow `*Api` it needs, so a fake in a test is that one
  /// resource, not the whole surface. The facade would hand every repository all
  /// of them.
  EngineDioProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'engineDioProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$engineDioHash();

  @$internal
  @override
  $ProviderElement<Dio> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  Dio create(Ref ref) {
    return engineDio(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(Dio value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<Dio>(value),
    );
  }
}

String _$engineDioHash() => r'7fd61bd18f4f2e60b73e8f03024671a576fc030c';

/// Server time, tracked from the `Date` header of every engine response.
///
/// Deadlines on the wire are absolute server timestamps, so every countdown in
/// the app measures against this rather than the device clock.

@ProviderFor(serverClock)
final serverClockProvider = ServerClockProvider._();

/// Server time, tracked from the `Date` header of every engine response.
///
/// Deadlines on the wire are absolute server timestamps, so every countdown in
/// the app measures against this rather than the device clock.

final class ServerClockProvider
    extends $FunctionalProvider<ServerClock, ServerClock, ServerClock>
    with $Provider<ServerClock> {
  /// Server time, tracked from the `Date` header of every engine response.
  ///
  /// Deadlines on the wire are absolute server timestamps, so every countdown in
  /// the app measures against this rather than the device clock.
  ServerClockProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'serverClockProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$serverClockHash();

  @$internal
  @override
  $ProviderElement<ServerClock> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  ServerClock create(Ref ref) {
    return serverClock(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(ServerClock value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<ServerClock>(value),
    );
  }
}

String _$serverClockHash() => r'3305c9476050c05d8e503d96005e86648cb7520f';

/// The pure Dart engine runtime.
///
/// Flutter configures authentication, timeouts, retry, and server-time tracking
/// on [engineDioProvider]. The client package owns generated HTTP resources,
/// repositories, socket-ticket exchange, and live-session coordination.

@ProviderFor(engineClient)
final engineClientProvider = EngineClientProvider._();

/// The pure Dart engine runtime.
///
/// Flutter configures authentication, timeouts, retry, and server-time tracking
/// on [engineDioProvider]. The client package owns generated HTTP resources,
/// repositories, socket-ticket exchange, and live-session coordination.

final class EngineClientProvider
    extends $FunctionalProvider<EigenClient, EigenClient, EigenClient>
    with $Provider<EigenClient> {
  /// The pure Dart engine runtime.
  ///
  /// Flutter configures authentication, timeouts, retry, and server-time tracking
  /// on [engineDioProvider]. The client package owns generated HTTP resources,
  /// repositories, socket-ticket exchange, and live-session coordination.
  EngineClientProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'engineClientProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$engineClientHash();

  @$internal
  @override
  $ProviderElement<EigenClient> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  EigenClient create(Ref ref) {
    return engineClient(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(EigenClient value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<EigenClient>(value),
    );
  }
}

String _$engineClientHash() => r'ce7d0913d6d0f5eb3c0619336e9c94ee4506de2b';
