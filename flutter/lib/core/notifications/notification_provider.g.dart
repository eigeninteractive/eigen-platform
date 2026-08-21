// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Application-wide push boundary.

@ProviderFor(notificationService)
final notificationServiceProvider = NotificationServiceProvider._();

/// Application-wide push boundary.

final class NotificationServiceProvider
    extends
        $FunctionalProvider<
          NotificationService,
          NotificationService,
          NotificationService
        >
    with $Provider<NotificationService> {
  /// Application-wide push boundary.
  NotificationServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'notificationServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$notificationServiceHash();

  @$internal
  @override
  $ProviderElement<NotificationService> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  NotificationService create(Ref ref) {
    return notificationService(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(NotificationService value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<NotificationService>(value),
    );
  }
}

String _$notificationServiceHash() =>
    r'd3ad71fb80e6e113c0e58bf0f66b07f943cd16ec';

/// Current app-facing notification permission and capability state.
///
/// Auto-disposes so it is re-fetched on demand. Invalidate this provider
/// in [AppLifecycleListener.onResume] so the Settings screen reflects any
/// changes the user made in system Settings while the app was backgrounded.

@ProviderFor(notificationPermissionStatus)
final notificationPermissionStatusProvider =
    NotificationPermissionStatusProvider._();

/// Current app-facing notification permission and capability state.
///
/// Auto-disposes so it is re-fetched on demand. Invalidate this provider
/// in [AppLifecycleListener.onResume] so the Settings screen reflects any
/// changes the user made in system Settings while the app was backgrounded.

final class NotificationPermissionStatusProvider
    extends
        $FunctionalProvider<
          AsyncValue<NotificationPermissionState>,
          NotificationPermissionState,
          FutureOr<NotificationPermissionState>
        >
    with
        $FutureModifier<NotificationPermissionState>,
        $FutureProvider<NotificationPermissionState> {
  /// Current app-facing notification permission and capability state.
  ///
  /// Auto-disposes so it is re-fetched on demand. Invalidate this provider
  /// in [AppLifecycleListener.onResume] so the Settings screen reflects any
  /// changes the user made in system Settings while the app was backgrounded.
  NotificationPermissionStatusProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'notificationPermissionStatusProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$notificationPermissionStatusHash();

  @$internal
  @override
  $FutureProviderElement<NotificationPermissionState> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<NotificationPermissionState> create(Ref ref) {
    return notificationPermissionStatus(ref);
  }
}

String _$notificationPermissionStatusHash() =>
    r'8a8b2340d9b64426b6075aaf9f256d6bb7c9029c';

/// Notification nudge appropriate for this install's next waiting-room frame.

@ProviderFor(notificationNudge)
final notificationNudgeProvider = NotificationNudgeProvider._();

/// Notification nudge appropriate for this install's next waiting-room frame.

final class NotificationNudgeProvider
    extends
        $FunctionalProvider<
          AsyncValue<NotificationNudgeState>,
          NotificationNudgeState,
          FutureOr<NotificationNudgeState>
        >
    with
        $FutureModifier<NotificationNudgeState>,
        $FutureProvider<NotificationNudgeState> {
  /// Notification nudge appropriate for this install's next waiting-room frame.
  NotificationNudgeProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'notificationNudgeProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$notificationNudgeHash();

  @$internal
  @override
  $FutureProviderElement<NotificationNudgeState> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<NotificationNudgeState> create(Ref ref) {
    return notificationNudge(ref);
  }
}

String _$notificationNudgeHash() => r'd4b0cbd4baadd4ad16a52ddee4a6d1a7a80d9b5b';
