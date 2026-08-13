// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'navigation_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Provider for the GoRouter instance with auth-based routing
/// Keep alive ensures the router is never disposed during app lifetime
///
/// Uses StreamListenable to automatically redirect when auth state changes

@ProviderFor(goRouter)
final goRouterProvider = GoRouterProvider._();

/// Provider for the GoRouter instance with auth-based routing
/// Keep alive ensures the router is never disposed during app lifetime
///
/// Uses StreamListenable to automatically redirect when auth state changes

final class GoRouterProvider
    extends $FunctionalProvider<GoRouter, GoRouter, GoRouter>
    with $Provider<GoRouter> {
  /// Provider for the GoRouter instance with auth-based routing
  /// Keep alive ensures the router is never disposed during app lifetime
  ///
  /// Uses StreamListenable to automatically redirect when auth state changes
  GoRouterProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'goRouterProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$goRouterHash();

  @$internal
  @override
  $ProviderElement<GoRouter> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  GoRouter create(Ref ref) {
    return goRouter(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GoRouter value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GoRouter>(value),
    );
  }
}

String _$goRouterHash() => r'f38bdaf2d142477236ae3cada0b9e0d7889df61f';
