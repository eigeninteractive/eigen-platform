import 'package:eigen_firebase/src/analytics/firebase_analytics_service.dart';
import 'package:eigen_firebase/src/auth/firebase_auth_gateway.dart';
import 'package:eigen_firebase/src/notifications/firebase_messaging_registration_factory.dart';
import 'package:eigen_firebase/src/notifications/firebase_notification_service.dart';
import 'package:eigen_flutter/adapters.dart';
import 'package:eigen_flutter/eigen_flutter.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_app_installations/firebase_app_installations.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Public Firebase deployment values for one app.
@immutable
final class FirebaseAdapterConfig {
  const FirebaseAdapterConfig({
    required this.googleWebClientId,
    required this.vapidKey,
    this.authDomain,
  });

  /// OAuth web/server client id used by Google Sign-In.
  final String googleWebClientId;

  /// Public Web Push certificate key from Firebase Cloud Messaging.
  final String vapidKey;

  /// Optional Firebase Hosting domain used by the web Auth popup.
  final String? authDomain;

  /// Validates provider values for the current platform before startup.
  void validate({required bool isWeb}) {
    final errors = <String>[];
    if (_isUnset(googleWebClientId)) {
      errors.add('GOOGLE_WEB_CLIENT_ID is required');
    }
    if (isWeb && _isUnset(vapidKey)) {
      errors.add('FIREBASE_VAPID_KEY is required for web');
    }
    final auth = authDomain;
    if (auth != null && !_isValidHost(auth)) {
      errors.add(
        'AUTH_DOMAIN must be a hostname without a scheme, port, or path',
      );
    }
    if (errors.isEmpty) return;
    throw StateError(
      'Invalid Firebase adapter configuration:\n'
      '${errors.map((error) => '- $error').join('\n')}',
    );
  }
}

/// Explicit collection policy for Firebase telemetry.
///
/// Collection defaults to off. Choose [releaseOnly] at the app composition
/// root when production telemetry is intended and covered by the app's privacy
/// disclosures and consent model.
@immutable
final class FirebaseTelemetryPolicy {
  const FirebaseTelemetryPolicy({
    this.analyticsEnabled = false,
    this.crashlyticsEnabled = false,
  });

  /// Enables both services only in a release build.
  factory FirebaseTelemetryPolicy.releaseOnly() => FirebaseTelemetryPolicy(
    analyticsEnabled: kReleaseMode,
    crashlyticsEnabled: kReleaseMode,
  );

  /// Whether Firebase Analytics collection is enabled for this run.
  final bool analyticsEnabled;

  /// Whether Firebase Crashlytics collection and error hooks are enabled.
  final bool crashlyticsEnabled;
}

/// Boots the standard Eigen Flutter app with Firebase-backed adapters.
///
/// [onBackgroundMessage] must be a top-level or static function annotated with
/// `@pragma('vm:entry-point')`; Firebase invokes it in a background isolate on
/// native platforms. Web background delivery remains service-worker owned.
Future<void> runFirebaseEngineApp({
  required GameModule module,
  required AppConfig config,
  required FirebaseOptions firebaseOptions,
  required FirebaseAdapterConfig firebase,
  required Future<void> Function(RemoteMessage) onBackgroundMessage,
  FirebaseTelemetryPolicy telemetry = const FirebaseTelemetryPolicy(),
}) {
  // Fail before the generic runner preserves the native splash.
  firebase.validate(isWeb: kIsWeb);
  return runEngineApp(
    module: module,
    config: config,
    initializeAdapter: () async {
      final authDomain = firebase.authDomain;
      await Firebase.initializeApp(
        options: authDomain == null
            ? firebaseOptions
            : firebaseOptions.copyWith(authDomain: authDomain),
      );

      await FirebaseAnalytics.instance.setAnalyticsCollectionEnabled(
        telemetry.analyticsEnabled,
      );
      if (!kIsWeb) {
        await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(
          telemetry.crashlyticsEnabled,
        );
        if (telemetry.crashlyticsEnabled) {
          FlutterError.onError =
              FirebaseCrashlytics.instance.recordFlutterFatalError;
          PlatformDispatcher.instance.onError = (error, stack) {
            FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
            return true;
          };
        }
        FirebaseMessaging.onBackgroundMessage(onBackgroundMessage);
      }

      final analytics = FirebaseAnalyticsService(FirebaseAnalytics.instance);
      final auth = FirebaseAuthGateway(
        FirebaseAuth.instance,
        googleWebClientId: firebase.googleWebClientId,
      );

      return [
        analyticsServiceProvider.overrideWithValue(analytics),
        authServiceProvider.overrideWithValue(auth),
        engineAccessTokenProvider.overrideWithValue(() async {
          final user = FirebaseAuth.instance.currentUser;
          return user == null ? null : await user.getIdToken();
        }),
        navigationObserversProvider.overrideWithValue([
          FirebaseAnalyticsObserver(analytics: FirebaseAnalytics.instance),
        ]),
        notificationServiceProvider.overrideWith((ref) {
          return FirebaseNotificationService(
            messaging: FirebaseMessaging.instance,
            messagingRegistration: createFirebaseMessagingRegistration(
              FirebaseMessaging.instance,
              FirebaseInstallations.instance,
            ),
            installations: FirebaseInstallations.instance,
            installationRepository: ref.watch(
              deviceInstallationRepositoryProvider,
            ),
            localNotifications: FlutterLocalNotificationsPlugin(),
            preferences: SharedPreferencesAsync(),
            currentUserId: () => ref.read(authServiceProvider).currentUser?.id,
            activeGameId: () {
              final uri = ref
                  .read(goRouterProvider)
                  .routerDelegate
                  .currentConfiguration
                  .uri;
              final segments = uri.pathSegments;
              return segments.length == 2 && segments[0] == 'game'
                  ? segments[1]
                  : null;
            },
            vapidKey: firebase.vapidKey,
          );
        }),
      ];
    },
  );
}

bool _isUnset(String value) =>
    value.trim().isEmpty || value.contains('REPLACE_ME');

bool _isValidHost(String value) {
  if (_isUnset(value) || value != value.trim()) return false;
  final uri = Uri.tryParse('https://$value');
  return uri != null &&
      uri.host == value &&
      uri.path.isEmpty &&
      !uri.hasQuery &&
      !uri.hasFragment;
}
