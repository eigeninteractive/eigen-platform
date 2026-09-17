// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'sync_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The signed-in account's sync pass, or null when nobody is signed in.

@ProviderFor(syncPass)
final syncPassProvider = SyncPassProvider._();

/// The signed-in account's sync pass, or null when nobody is signed in.

final class SyncPassProvider
    extends
        $FunctionalProvider<
          AsyncValue<SyncPass?>,
          SyncPass?,
          FutureOr<SyncPass?>
        >
    with $FutureModifier<SyncPass?>, $FutureProvider<SyncPass?> {
  /// The signed-in account's sync pass, or null when nobody is signed in.
  SyncPassProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'syncPassProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$syncPassHash();

  @$internal
  @override
  $FutureProviderElement<SyncPass?> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<SyncPass?> create(Ref ref) {
    return syncPass(ref);
  }
}

String _$syncPassHash() => r'341b64cbb30b10a12b5d99d2c8968ddd8bf20860';

/// Runs the account's sync pass whenever there is reason to (decision 0013).
///
/// The reasons are events, never a timer: somebody signs in, the device
/// regains connectivity, a push arrives while the app is open, and a local game
/// finishes. An app also calls [run] when the player comes back to it and on
/// pull-to-refresh; coming back is the application's lifecycle to observe,
/// which is why it is not wired here. However many reasons arrive together, the
/// pass itself runs once for them (decision 0014).
///
/// Nothing here blocks a screen: every screen reads the replica, and a pass
/// only changes what it shows.

@ProviderFor(SyncCoordinator)
final syncCoordinatorProvider = SyncCoordinatorProvider._();

/// Runs the account's sync pass whenever there is reason to (decision 0013).
///
/// The reasons are events, never a timer: somebody signs in, the device
/// regains connectivity, a push arrives while the app is open, and a local game
/// finishes. An app also calls [run] when the player comes back to it and on
/// pull-to-refresh; coming back is the application's lifecycle to observe,
/// which is why it is not wired here. However many reasons arrive together, the
/// pass itself runs once for them (decision 0014).
///
/// Nothing here blocks a screen: every screen reads the replica, and a pass
/// only changes what it shows.
final class SyncCoordinatorProvider
    extends $NotifierProvider<SyncCoordinator, SyncStatus> {
  /// Runs the account's sync pass whenever there is reason to (decision 0013).
  ///
  /// The reasons are events, never a timer: somebody signs in, the device
  /// regains connectivity, a push arrives while the app is open, and a local game
  /// finishes. An app also calls [run] when the player comes back to it and on
  /// pull-to-refresh; coming back is the application's lifecycle to observe,
  /// which is why it is not wired here. However many reasons arrive together, the
  /// pass itself runs once for them (decision 0014).
  ///
  /// Nothing here blocks a screen: every screen reads the replica, and a pass
  /// only changes what it shows.
  SyncCoordinatorProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'syncCoordinatorProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$syncCoordinatorHash();

  @$internal
  @override
  SyncCoordinator create() => SyncCoordinator();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SyncStatus value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SyncStatus>(value),
    );
  }
}

String _$syncCoordinatorHash() => r'885eb8fe3f215402f75ad15d90e8ef1de6c9c7cb';

/// Runs the account's sync pass whenever there is reason to (decision 0013).
///
/// The reasons are events, never a timer: somebody signs in, the device
/// regains connectivity, a push arrives while the app is open, and a local game
/// finishes. An app also calls [run] when the player comes back to it and on
/// pull-to-refresh; coming back is the application's lifecycle to observe,
/// which is why it is not wired here. However many reasons arrive together, the
/// pass itself runs once for them (decision 0014).
///
/// Nothing here blocks a screen: every screen reads the replica, and a pass
/// only changes what it shows.

abstract class _$SyncCoordinator extends $Notifier<SyncStatus> {
  SyncStatus build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<SyncStatus, SyncStatus>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<SyncStatus, SyncStatus>,
              SyncStatus,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
