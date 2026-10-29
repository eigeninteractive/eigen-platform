import 'dart:async';

import 'package:eigen_firebase/src/notifications/firebase_notification_service.dart';
import 'package:eigen_flutter/adapters.dart';
import 'package:firebase_app_installations/firebase_app_installations.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _Settings extends Fake implements NotificationSettings {
  @override
  AuthorizationStatus get authorizationStatus => AuthorizationStatus.authorized;
}

class _Messaging extends Fake implements FirebaseMessaging {
  final registered = StreamController<String>.broadcast();
  final unregistered = StreamController<String>.broadcast();
  int registrations = 0;
  @override
  Stream<String> get onRegistered => registered.stream;
  @override
  Stream<String> get onUnregistered => unregistered.stream;
  @override
  Future<void> register({
    String? vapidKey,
    String? serviceWorkerScriptPath,
  }) async {
    registrations++;
    // The released API announces the acknowledged FID even on repeat calls.
    registered.add('acknowledged-fid');
  }

  @override
  Future<NotificationSettings> getNotificationSettings() async => _Settings();
  @override
  Future<void> setForegroundNotificationPresentationOptions({
    bool alert = false,
    bool badge = false,
    bool sound = false,
  }) async {}
  @override
  Future<RemoteMessage?> getInitialMessage() async => null;
}

class _Installations extends Fake implements FirebaseInstallations {
  @override
  Future<String> getId() async => 'acknowledged-fid';
}

class _Notifications extends Fake implements FlutterLocalNotificationsPlugin {
  @override
  T? resolvePlatformSpecificImplementation<
    T extends FlutterLocalNotificationsPlatform
  >() => null;
  @override
  Future<bool?> initialize({
    required InitializationSettings settings,
    DidReceiveNotificationResponseCallback? onDidReceiveNotificationResponse,
    DidReceiveBackgroundNotificationResponseCallback?
    onDidReceiveBackgroundNotificationResponse,
  }) async => true;
}

class _Preferences extends Fake implements SharedPreferencesAsync {
  final values = <String, String>{};
  @override
  Future<String?> getString(String key) async => values[key];
  @override
  Future<void> setString(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }
}

class _Repository extends Fake implements DeviceInstallationRepository {
  final upserts = <String>[];
  final deletes = <String>[];
  @override
  Future<void> upsert({required String fid}) async {
    upserts.add(fid);
  }

  @override
  Future<void> delete({required String fid}) async {
    deletes.add(fid);
  }
}

Future<void> _drain() async {
  for (var i = 0; i < 10; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'acknowledged FIDs reconcile startup, account changes and unregistration',
    () async {
      final messaging = _Messaging();
      final repository = _Repository();
      final preferences = _Preferences();
      String? user = 'guest';
      final service = FirebaseNotificationService(
        messaging: messaging,
        installations: _Installations(),
        installationRepository: repository,
        localNotifications: _Notifications(),
        preferences: preferences,
        activeGameId: () => null,
        currentUserId: () => user,
        vapidKey: 'public-key',
      );
      addTearDown(messaging.registered.close);
      addTearDown(messaging.unregistered.close);

      await service.initialize();
      await _drain();
      expect(repository.upserts, ['acknowledged-fid']);
      expect(preferences.values.values, ['guest:acknowledged-fid']);

      user = 'account';
      await service.registerInstallation();
      await _drain();
      expect(messaging.registrations, 2);
      expect(preferences.values.values, ['account:acknowledged-fid']);

      messaging.unregistered.add('acknowledged-fid');
      await _drain();
      expect(repository.deletes, ['acknowledged-fid']);
      expect(preferences.values, isEmpty);

      await service.registerInstallation();
      await _drain();
      expect(repository.upserts, hasLength(3));
      await service.deleteCurrentInstallation();
      user = null;
      messaging.registered.add('renewed-after-signout');
      await _drain();
      expect(repository.upserts, hasLength(3));
      expect(repository.deletes, ['acknowledged-fid', 'acknowledged-fid']);
      expect(preferences.values, isEmpty);
    },
  );
}
