// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'connectivity_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The device's connectivity: what it is now, then every change.
///
/// Reflects network interface availability, not internet reachability: a
/// connected Wi-Fi with no route to the internet does not report
/// [ConnectivityResult.none].
///
/// The current state is read explicitly because the change stream does not
/// promise one. A browser reports only `online` and `offline` events, so an app
/// opened with no network would otherwise believe itself online until the
/// network came and went again. A change that arrives before that read answers
/// is newer, and the read is then dropped.

@ProviderFor(connectivity)
final connectivityProvider = ConnectivityProvider._();

/// The device's connectivity: what it is now, then every change.
///
/// Reflects network interface availability, not internet reachability: a
/// connected Wi-Fi with no route to the internet does not report
/// [ConnectivityResult.none].
///
/// The current state is read explicitly because the change stream does not
/// promise one. A browser reports only `online` and `offline` events, so an app
/// opened with no network would otherwise believe itself online until the
/// network came and went again. A change that arrives before that read answers
/// is newer, and the read is then dropped.

final class ConnectivityProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<ConnectivityResult>>,
          List<ConnectivityResult>,
          Stream<List<ConnectivityResult>>
        >
    with
        $FutureModifier<List<ConnectivityResult>>,
        $StreamProvider<List<ConnectivityResult>> {
  /// The device's connectivity: what it is now, then every change.
  ///
  /// Reflects network interface availability, not internet reachability: a
  /// connected Wi-Fi with no route to the internet does not report
  /// [ConnectivityResult.none].
  ///
  /// The current state is read explicitly because the change stream does not
  /// promise one. A browser reports only `online` and `offline` events, so an app
  /// opened with no network would otherwise believe itself online until the
  /// network came and went again. A change that arrives before that read answers
  /// is newer, and the read is then dropped.
  ConnectivityProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'connectivityProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$connectivityHash();

  @$internal
  @override
  $StreamProviderElement<List<ConnectivityResult>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<ConnectivityResult>> create(Ref ref) {
    return connectivity(ref);
  }
}

String _$connectivityHash() => r'a7214eba57e1ba87a1c8e29132c3204b7b5f0bb2';

/// True when every connectivity result is [ConnectivityResult.none].
///
/// Returns false during the brief loading window before the current state is
/// known.

@ProviderFor(isOffline)
final isOfflineProvider = IsOfflineProvider._();

/// True when every connectivity result is [ConnectivityResult.none].
///
/// Returns false during the brief loading window before the current state is
/// known.

final class IsOfflineProvider extends $FunctionalProvider<bool, bool, bool>
    with $Provider<bool> {
  /// True when every connectivity result is [ConnectivityResult.none].
  ///
  /// Returns false during the brief loading window before the current state is
  /// known.
  IsOfflineProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'isOfflineProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$isOfflineHash();

  @$internal
  @override
  $ProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  bool create(Ref ref) {
    return isOffline(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(bool value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<bool>(value),
    );
  }
}

String _$isOfflineHash() => r'4c3d8a7c4c892893b58168033657ca11dee5428f';
