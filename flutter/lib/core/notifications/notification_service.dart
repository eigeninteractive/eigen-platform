/// App-facing notification permission and capability state.
enum NotificationPermissionState {
  /// Push is unavailable or no notification adapter is installed.
  unavailable,

  /// The app can ask, and has not received a decision yet.
  promptable,

  /// Notifications are authorized.
  enabled,

  /// Permission was denied or disabled in system settings.
  blocked,
}

/// Permission was granted, but push registration could not be completed.
final class NotificationRegistrationException implements Exception {
  const NotificationRegistrationException([this.cause]);

  /// The adapter-specific failure, when available.
  final Object? cause;

  @override
  String toString() => 'NotificationRegistrationException: $cause';
}

/// Push capability consumed by the Flutter presentation package.
abstract interface class NotificationService {
  /// Deep links selected from notifications.
  Stream<String> get navigationStream;

  /// Installs listeners and restores any existing registration.
  Future<void> initialize();

  /// Associates this installation with the current signed-in user.
  Future<void> registerInstallation();

  /// Removes this installation from the current user's push targets.
  Future<void> deleteCurrentInstallation();

  /// Reads the current capability state without prompting.
  Future<NotificationPermissionState> permissionState();

  /// Requests permission after an explicit user gesture.
  Future<NotificationPermissionState> requestPermission();

  /// Reconciles permission and server registration after lifecycle changes.
  Future<NotificationPermissionState> syncPermissionAndRegistration();
}

/// Notification adapter used when push is not enabled by the embedding app.
final class NoopNotificationService implements NotificationService {
  const NoopNotificationService();

  @override
  Stream<String> get navigationStream => const Stream.empty();

  @override
  Future<void> initialize() async {}

  @override
  Future<void> registerInstallation() async {}

  @override
  Future<void> deleteCurrentInstallation() async {}

  @override
  Future<NotificationPermissionState> permissionState() async =>
      NotificationPermissionState.unavailable;

  @override
  Future<NotificationPermissionState> requestPermission() async =>
      NotificationPermissionState.unavailable;

  @override
  Future<NotificationPermissionState> syncPermissionAndRegistration() async =>
      NotificationPermissionState.unavailable;
}
