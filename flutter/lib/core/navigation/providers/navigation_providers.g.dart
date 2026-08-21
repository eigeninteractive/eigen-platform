// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'navigation_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Route observers installed by optional navigation adapters.

@ProviderFor(navigationObservers)
final navigationObserversProvider = NavigationObserversProvider._();

/// Route observers installed by optional navigation adapters.

final class NavigationObserversProvider
    extends
        $FunctionalProvider<
          List<NavigatorObserver>,
          List<NavigatorObserver>,
          List<NavigatorObserver>
        >
    with $Provider<List<NavigatorObserver>> {
  /// Route observers installed by optional navigation adapters.
  NavigationObserversProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'navigationObserversProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$navigationObserversHash();

  @$internal
  @override
  $ProviderElement<List<NavigatorObserver>> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  List<NavigatorObserver> create(Ref ref) {
    return navigationObservers(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(List<NavigatorObserver> value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<List<NavigatorObserver>>(value),
    );
  }
}

String _$navigationObserversHash() =>
    r'e0a5b1239ec15b37c4739b2ab6b91bea6a41efcc';

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

String _$goRouterHash() => r'3e582d69363b4e15b5314d0feb78d5b9db69b72a';
