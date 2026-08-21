import 'package:flutter/foundation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:eigen_flutter/core/notifications/notification_service.dart';

part 'notification_provider.g.dart';

/// Presentation state for the notification nudge in a multiplayer waiting room.
enum NotificationNudgeState {
  /// Nothing should be rendered.
  hidden,

  /// Explain the benefit and offer an inline permission action.
  enable,

  /// Permission is blocked; explain how to restore it in platform settings.
  openSettings,
}

/// Resolves permission state into waiting-room UI.
@visibleForTesting
NotificationNudgeState resolveNotificationNudgeState({
  required NotificationPermissionState permissionState,
}) => switch (permissionState) {
  NotificationPermissionState.unavailable ||
  NotificationPermissionState.enabled => NotificationNudgeState.hidden,
  NotificationPermissionState.promptable => NotificationNudgeState.enable,
  NotificationPermissionState.blocked => NotificationNudgeState.openSettings,
};

/// Application-wide push boundary.
@Riverpod(keepAlive: true)
NotificationService notificationService(Ref ref) =>
    const NoopNotificationService();

/// Current app-facing notification permission and capability state.
///
/// Auto-disposes so it is re-fetched on demand. Invalidate this provider
/// in [AppLifecycleListener.onResume] so the Settings screen reflects any
/// changes the user made in system Settings while the app was backgrounded.
@riverpod
Future<NotificationPermissionState> notificationPermissionStatus(Ref ref) =>
    ref.watch(notificationServiceProvider).permissionState();

/// Notification nudge appropriate for this install's next waiting-room frame.
@riverpod
Future<NotificationNudgeState> notificationNudge(Ref ref) async {
  final permissionState = await ref.watch(
    notificationPermissionStatusProvider.future,
  );
  return resolveNotificationNudgeState(permissionState: permissionState);
}
